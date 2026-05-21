/// <reference lib="webworker" />

import { assessImageDimensions } from "@/lib/enhancer/image-size";
import { loadModelBufferWithCache } from "@/lib/enhancer/model-cache";
import {
  BACKGROUND_REMOVAL_MODEL_SPECS,
  type BackgroundRemovalMode,
  type BackgroundRemovalModelSpec,
} from "@/lib/enhancer/models";
import type { InferenceBackend } from "@/lib/enhancer/runtime-plan";
import type {
  BackgroundRemovalJobInput,
  BackgroundRemovalWorkerRequest,
  WorkerResponse,
} from "@/lib/enhancer/worker-protocol";
import type { InferenceSession } from "onnxruntime-web";

const ORT_ASSET_BASE_PATH = "/ort/";

type OrtModule = typeof import("onnxruntime-web/all");
type WebGpuDevice = NonNullable<
  InferenceSession.ExecutionProviderOptionMap["webgpu"]["device"]
>;

interface WorkerGpuAdapter {
  limits: Record<string, number>;
  requestDevice(descriptor?: {
    requiredFeatures?: readonly string[];
    requiredLimits?: Record<string, number>;
  }): Promise<WebGpuDevice>;
}

interface WorkerNavigatorWithGpu {
  gpu?: {
    requestAdapter(options?: {
      powerPreference?: "low-power" | "high-performance";
    }): Promise<WorkerGpuAdapter | null>;
  };
}

interface TensorMeta {
  name: string;
  isTensor: boolean;
  type: string;
  shape: Array<number | string>;
}

interface SessionBundle {
  module: OrtModule;
  session: Awaited<ReturnType<OrtModule["InferenceSession"]["create"]>>;
  inputName: string;
  outputName: string;
  inputTensorType: "float32" | "float16";
  fixedInputWidth: number | null;
  fixedInputHeight: number | null;
  activeBackend: InferenceBackend;
  backendWarning: string | null;
}

const sessionCache = new Map<string, SessionBundle>();
let ortModulePromise: Promise<OrtModule> | null = null;
let biRefNetWebGpuDevicePromise: Promise<WebGpuDevice> | null = null;
let ortConfigured = false;
const fp32Scratch = new Float32Array(1);
const int32Scratch = new Int32Array(fp32Scratch.buffer);

function getExpectedTime(
  backend: InferenceBackend,
  mode: BackgroundRemovalMode,
) {
  if (mode === "birefnet-lite-fp16") {
    return backend === "webgpu" ? "5-20 sec" : "60-120 sec";
  }

  return backend === "webgpu" ? "2-8 sec" : "5-20 sec";
}

function getExecutionProvider(backend: InferenceBackend) {
  if (backend === "webgpu") {
    return "webgpu";
  }
  if (backend === "webgl") {
    return "webgl";
  }
  return "wasm";
}

function resolveFixedDimension(
  value: number | string | undefined,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function resolveInputTensorType(inputMeta: TensorMeta | null) {
  const type = inputMeta?.type.toLowerCase() ?? "";
  if (type.includes("float16")) {
    return "float16";
  }

  return "float32";
}

function clamp01(value: number) {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function clampToByte(value: number) {
  if (value <= 0) {
    return 0;
  }
  if (value >= 255) {
    return 255;
  }
  return Math.round(value);
}

function floatToHalf(value: number): number {
  fp32Scratch[0] = value;
  const x = int32Scratch[0];
  if (!x) {
    return 0;
  }

  let bits = (x >> 16) & 0x8000;
  let m = (x >> 12) & 0x07ff;
  const e = (x >> 23) & 0xff;

  if (e < 103) {
    return bits;
  }

  if (e > 142) {
    bits |= 0x7c00;
    bits |= (e === 255 ? 0 : 1) && x & 0x007fffff;
    return bits;
  }

  if (e < 113) {
    m |= 0x0800;
    bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
    return bits;
  }

  bits |= ((e - 112) << 10) | (m >> 1);
  bits += m & 1;
  return bits;
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function halfToFloat(value: number) {
  const sign = value & 0x8000 ? -1 : 1;
  const exponent = (value >> 10) & 0x1f;
  const fraction = value & 0x03ff;

  if (exponent === 0) {
    return sign * 2 ** -14 * (fraction / 1024);
  }

  if (exponent === 31) {
    return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  }

  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function readTensorValue(data: unknown, index: number) {
  if (data instanceof Float32Array || data instanceof Float64Array) {
    return data[index] ?? 0;
  }

  if (data instanceof Uint16Array) {
    return halfToFloat(data[index] ?? 0);
  }

  if (data instanceof Uint8Array || data instanceof Int32Array) {
    return data[index] ?? 0;
  }

  throw new Error("Unexpected output tensor data type.");
}

function getTensorMetadataByName(
  metadata: unknown,
  name: string,
): TensorMeta | null {
  if (Array.isArray(metadata)) {
    const found = metadata.find((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      return (entry as { name?: string }).name === name;
    });
    if (!found || typeof found !== "object") {
      return null;
    }
    return found as TensorMeta;
  }

  if (metadata && typeof metadata === "object") {
    const mapValue = (metadata as Record<string, unknown>)[name];
    if (mapValue && typeof mapValue === "object") {
      return mapValue as TensorMeta;
    }
  }

  return null;
}

async function getOrtModule() {
  if (!ortModulePromise) {
    ortModulePromise = import("onnxruntime-web/all");
  }

  const ortModule = await ortModulePromise;
  if (!ortConfigured) {
    ortModule.env.logLevel = "error";
    ortModule.env.wasm.wasmPaths = ORT_ASSET_BASE_PATH;
    ortModule.env.wasm.proxy = false;
    ortModule.env.wasm.numThreads = 1;
    ortConfigured = true;
  }

  return ortModule;
}

async function getBiRefNetWebGpuDevice() {
  if (!biRefNetWebGpuDevicePromise) {
    biRefNetWebGpuDevicePromise = (async () => {
      if (typeof navigator === "undefined") {
        throw new Error("WebGPU is unavailable in this worker.");
      }

      const gpu = (navigator as WorkerNavigatorWithGpu).gpu;
      if (!gpu) {
        throw new Error("WebGPU is unavailable in this browser.");
      }

      const adapter = await gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter) {
        throw new Error("WebGPU adapter is unavailable.");
      }

      // Defense-in-depth: reject adapters whose storage buffer limit is too
      // low for BiRefNet-lite's compute shaders (need up to 32-65 bindings).
      const storageBufferLimit =
        adapter.limits.maxStorageBuffersPerShaderStage ?? 8;
      if (storageBufferLimit < 10) {
        throw new Error(
          `GPU only supports ${storageBufferLimit} storage buffers per shader ` +
            "stage (BiRefNet-lite needs significantly more). " +
            "This device is not compatible with BiRefNet.",
        );
      }

      const requiredLimits: Record<string, number> = {};
      const limitKeys = [
        "maxStorageBuffersPerShaderStage",
        "maxStorageBufferBindingSize",
        "maxBufferSize",
        "maxComputeWorkgroupStorageSize",
        "maxComputeInvocationsPerWorkgroup",
        "maxComputeWorkgroupSizeX",
        "maxComputeWorkgroupSizeY",
        "maxComputeWorkgroupSizeZ",
        "maxComputeWorkgroupsPerDimension",
        "maxBindingsPerBindGroup",
        "maxBindGroups",
        "maxUniformBufferBindingSize",
        "maxUniformBuffersPerShaderStage",
        "maxTextureDimension1D",
        "maxTextureDimension2D",
        "maxTextureDimension3D",
        "maxTextureArrayLayers",
      ];
      for (const key of limitKeys) {
        if (key in adapter.limits) {
          requiredLimits[key] = adapter.limits[key];
        }
      }

      return adapter.requestDevice({
        requiredFeatures: ["shader-f16"],
        requiredLimits,
      });
    })();
  }

  const devicePromise = biRefNetWebGpuDevicePromise;
  try {
    return await devicePromise;
  } catch (error) {
    if (biRefNetWebGpuDevicePromise === devicePromise) {
      biRefNetWebGpuDevicePromise = null;
    }
    throw error;
  }
}

async function createSessionOptions(
  mode: BackgroundRemovalMode,
  executionProvider: string,
): Promise<InferenceSession.SessionOptions> {
  if (mode === "birefnet-lite-fp16") {
    if (executionProvider !== "webgpu") {
      throw new Error("BiRefNet-lite background removal requires WebGPU.");
    }

    return {
      executionProviders: [
        {
          name: "webgpu",
          device: await getBiRefNetWebGpuDevice(),
          validationMode: "disabled",
        },
      ],
      graphOptimizationLevel: "disabled",
    };
  }

  return {
    executionProviders: [executionProvider],
    graphOptimizationLevel: mode === "u2netp" ? "disabled" : "all",
  };
}

async function createSessionBundle(
  mode: BackgroundRemovalMode,
  requestedBackend: InferenceBackend,
  modelBuffer: ArrayBuffer,
): Promise<SessionBundle> {
  const cacheKey = `${requestedBackend}:${mode}`;
  const cachedSession = sessionCache.get(cacheKey);
  if (cachedSession) {
    return cachedSession;
  }

  if (mode === "birefnet-lite-fp16" && requestedBackend !== "webgpu") {
    throw new Error("BiRefNet-lite background removal requires WebGPU.");
  }

  const ort = await getOrtModule();
  const preferredExecutionProvider = getExecutionProvider(requestedBackend);

  const buildSession = async (executionProvider: string) => {
    return ort.InferenceSession.create(
      modelBuffer,
      await createSessionOptions(mode, executionProvider),
    );
  };

  let session: Awaited<
    ReturnType<OrtModule["InferenceSession"]["create"]>
  > | null = null;
  let activeBackend = requestedBackend;
  let backendWarning: string | null = null;

  try {
    session = await buildSession(preferredExecutionProvider);
  } catch {
    if (requestedBackend === "wasm" || mode === "birefnet-lite-fp16") {
      throw new Error(
        `Failed to initialize ONNX session on ${requestedBackend.toUpperCase()} backend.`,
      );
    }

    session = await buildSession("wasm");
    activeBackend = "wasm";
    backendWarning = `Requested ${requestedBackend.toUpperCase()} backend is unavailable for this model. Switched to WASM.`;
  }

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName) {
    throw new Error("ONNX session is missing input/output names.");
  }

  const inputMeta = getTensorMetadataByName(
    (session as { inputMetadata?: unknown }).inputMetadata,
    inputName,
  );

  const shape = inputMeta?.shape ?? [];
  const inputTensorType = resolveInputTensorType(inputMeta);
  const fixedInputHeight = resolveFixedDimension(shape[2]);
  const fixedInputWidth = resolveFixedDimension(shape[3]);

  const bundle: SessionBundle = {
    module: ort,
    session,
    inputName,
    outputName,
    inputTensorType,
    fixedInputWidth,
    fixedInputHeight,
    activeBackend,
    backendWarning,
  };

  sessionCache.set(cacheKey, bundle);
  if (activeBackend !== requestedBackend) {
    sessionCache.set(`${activeBackend}:${mode}`, bundle);
  }

  return bundle;
}

async function imageBitmapFromFile(file: File) {
  if (typeof createImageBitmap !== "function") {
    throw new Error(
      "Browser does not support createImageBitmap in Worker context.",
    );
  }
  return createImageBitmap(file);
}

function createInputTensorFromImageData(
  ort: OrtModule,
  imageData: ImageData,
  spec: BackgroundRemovalModelSpec,
  inputTensorType: "float32" | "float16",
) {
  const { width, height } = imageData;
  const planeSize = width * height;
  const isFp16 = inputTensorType === "float16";
  const tensorData = isFp16
    ? new Uint16Array(planeSize * 3)
    : new Float32Array(planeSize * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const position = y * width + x;
      const alpha = imageData.data[pixelIndex + 3] / 255;
      const r = (imageData.data[pixelIndex] * alpha + 255 * (1 - alpha)) / 255;
      const g =
        (imageData.data[pixelIndex + 1] * alpha + 255 * (1 - alpha)) / 255;
      const b =
        (imageData.data[pixelIndex + 2] * alpha + 255 * (1 - alpha)) / 255;

      const normR = (r - spec.mean[0]) / spec.std[0];
      const normG = (g - spec.mean[1]) / spec.std[1];
      const normB = (b - spec.mean[2]) / spec.std[2];

      if (isFp16) {
        tensorData[position] = floatToHalf(normR);
        tensorData[planeSize + position] = floatToHalf(normG);
        tensorData[planeSize * 2 + position] = floatToHalf(normB);
      } else {
        tensorData[position] = normR;
        tensorData[planeSize + position] = normG;
        tensorData[planeSize * 2 + position] = normB;
      }
    }
  }

  return new ort.Tensor(inputTensorType, tensorData, [1, 3, height, width]);
}

function resolveMaskShape(
  dims: readonly number[],
  fallbackWidth: number,
  fallbackHeight: number,
) {
  if (dims.length >= 4) {
    if (dims[1] === 1) {
      return {
        width: dims[3] ?? fallbackWidth,
        height: dims[2] ?? fallbackHeight,
      };
    }
    if (dims[3] === 1) {
      return {
        width: dims[2] ?? fallbackWidth,
        height: dims[1] ?? fallbackHeight,
      };
    }
  }

  if (dims.length === 3) {
    return {
      width: dims[2] ?? fallbackWidth,
      height: dims[1] ?? fallbackHeight,
    };
  }

  if (dims.length === 2) {
    return {
      width: dims[1] ?? fallbackWidth,
      height: dims[0] ?? fallbackHeight,
    };
  }

  return { width: fallbackWidth, height: fallbackHeight };
}

function createMaskImageData(
  data: unknown,
  dims: readonly number[],
  spec: BackgroundRemovalModelSpec,
  fallbackWidth: number,
  fallbackHeight: number,
) {
  const { width, height } = resolveMaskShape(
    dims,
    fallbackWidth,
    fallbackHeight,
  );
  const area = width * height;
  const imageData = new ImageData(width, height);

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  if (spec.outputTransform === "minmax") {
    for (let i = 0; i < area; i += 1) {
      const value = readTensorValue(data, i);
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
  }

  const denominator = max - min;
  for (let i = 0; i < area; i += 1) {
    const rawValue = readTensorValue(data, i);
    const alpha =
      spec.outputTransform === "sigmoid"
        ? sigmoid(rawValue)
        : denominator > 1e-8
          ? (rawValue - min) / denominator
          : rawValue;
    const pixelIndex = i * 4;
    const alphaByte = clampToByte(clamp01(alpha) * 255);

    imageData.data[pixelIndex] = 255;
    imageData.data[pixelIndex + 1] = 255;
    imageData.data[pixelIndex + 2] = 255;
    imageData.data[pixelIndex + 3] = alphaByte;
  }

  return imageData;
}

function resizeMaskToSource(
  maskImageData: ImageData,
  width: number,
  height: number,
) {
  const maskCanvas = new OffscreenCanvas(
    maskImageData.width,
    maskImageData.height,
  );
  const maskContext = maskCanvas.getContext("2d");
  if (!maskContext) {
    throw new Error("Unable to create mask canvas context.");
  }
  maskContext.putImageData(maskImageData, 0, 0);

  const resizedCanvas = new OffscreenCanvas(width, height);
  const resizedContext = resizedCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!resizedContext) {
    throw new Error("Unable to create resized mask context.");
  }

  resizedContext.imageSmoothingEnabled = true;
  resizedContext.imageSmoothingQuality = "high";
  resizedContext.drawImage(maskCanvas, 0, 0, width, height);
  return resizedContext.getImageData(0, 0, width, height);
}

function applyMaskToSource(
  sourceImageData: ImageData,
  maskImageData: ImageData,
) {
  const output = new ImageData(sourceImageData.width, sourceImageData.height);

  for (let i = 0; i < sourceImageData.data.length; i += 4) {
    const sourceAlpha = sourceImageData.data[i + 3] / 255;
    const maskAlpha = maskImageData.data[i + 3] / 255;
    const alpha = sourceAlpha * maskAlpha;

    output.data[i] = sourceImageData.data[i];
    output.data[i + 1] = sourceImageData.data[i + 1];
    output.data[i + 2] = sourceImageData.data[i + 2];
    output.data[i + 3] = clampToByte(alpha * 255);
  }

  return output;
}

async function runInference(
  sourceContext: OffscreenCanvasRenderingContext2D,
  sessionBundle: SessionBundle,
  spec: BackgroundRemovalModelSpec,
  inputWidth: number,
  inputHeight: number,
) {
  const inputCanvas = new OffscreenCanvas(inputWidth, inputHeight);
  const inputContext = inputCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!inputContext) {
    throw new Error("Unable to create model input context.");
  }

  inputContext.imageSmoothingEnabled = true;
  inputContext.imageSmoothingQuality = "high";
  inputContext.drawImage(sourceContext.canvas, 0, 0, inputWidth, inputHeight);

  const inputImageData = inputContext.getImageData(
    0,
    0,
    inputWidth,
    inputHeight,
  );
  const inputTensor = createInputTensorFromImageData(
    sessionBundle.module,
    inputImageData,
    spec,
    sessionBundle.inputTensorType,
  );

  let outputTensor: {
    data: unknown;
    dims: readonly number[];
    dispose?: () => void;
  } | null = null;

  try {
    const inferenceResult = await sessionBundle.session.run({
      [sessionBundle.inputName]: inputTensor,
    });

    outputTensor = inferenceResult[sessionBundle.outputName] as {
      data: unknown;
      dims: readonly number[];
      dispose?: () => void;
    } | null;
    if (!outputTensor) {
      throw new Error("Model output tensor is missing.");
    }

    return createMaskImageData(
      outputTensor.data,
      outputTensor.dims,
      spec,
      inputWidth,
      inputHeight,
    );
  } finally {
    if ("dispose" in inputTensor && typeof inputTensor.dispose === "function") {
      inputTensor.dispose();
    }
    if (outputTensor && typeof outputTensor.dispose === "function") {
      outputTensor.dispose();
    }
  }
}

async function runBackgroundRemovalPipeline(
  requestId: string,
  file: File,
  mode: BackgroundRemovalMode,
  backend: InferenceBackend,
  timeoutMs: number,
  inheritedWarning: string | null,
  postMessageSafe: (message: WorkerResponse) => void,
) {
  const bitmap = await imageBitmapFromFile(file);
  const startedAt = performance.now();

  try {
    const sizeAssessment = assessImageDimensions(bitmap.width, bitmap.height);
    if (sizeAssessment.blockingError) {
      throw new Error(sizeAssessment.blockingError);
    }

    const selectedSpec = BACKGROUND_REMOVAL_MODEL_SPECS[mode];

    postMessageSafe({
      type: "progress",
      requestId,
      progress: 10,
      message: "Loading matte model...",
    });

    const modelLoadResult = await loadModelBufferWithCache(selectedSpec.url);
    if (!modelLoadResult.buffer) {
      throw new Error(
        modelLoadResult.warning ?? "Background removal model could not load.",
      );
    }

    const modelSession = await createSessionBundle(
      mode,
      backend,
      modelLoadResult.buffer,
    );
    const activeBackend = modelSession.activeBackend;

    postMessageSafe({
      type: "ready",
      requestId,
      mode,
      backend: activeBackend,
      estimatedTime: getExpectedTime(activeBackend, mode),
      modelCached: modelLoadResult.cached,
      usingFallback: inheritedWarning !== null,
      warning:
        inheritedWarning ??
        modelSession.backendWarning ??
        modelLoadResult.warning ??
        sizeAssessment.warning,
    });

    const sourceCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const sourceContext = sourceCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!sourceContext) {
      throw new Error("Unable to create source canvas context.");
    }
    sourceContext.drawImage(bitmap, 0, 0);

    const inputWidth = modelSession.fixedInputWidth ?? selectedSpec.inputWidth;
    const inputHeight =
      modelSession.fixedInputHeight ?? selectedSpec.inputHeight;

    postMessageSafe({
      type: "progress",
      requestId,
      progress: 35,
      message: "Estimating foreground matte...",
    });

    const maskImageData = await runInference(
      sourceContext,
      modelSession,
      selectedSpec,
      inputWidth,
      inputHeight,
    );

    if (performance.now() - startedAt > timeoutMs) {
      throw new Error("Background removal timed out on the selected model.");
    }

    postMessageSafe({
      type: "progress",
      requestId,
      progress: 78,
      message: "Applying transparent alpha...",
    });

    const sourceImageData = sourceContext.getImageData(
      0,
      0,
      bitmap.width,
      bitmap.height,
    );
    const resizedMask = resizeMaskToSource(
      maskImageData,
      bitmap.width,
      bitmap.height,
    );
    const outputImageData = applyMaskToSource(sourceImageData, resizedMask);

    const outputCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
      throw new Error("Unable to create output canvas context.");
    }
    outputContext.putImageData(outputImageData, 0, 0);

    const resultBlob = await outputCanvas.convertToBlob({
      type: "image/png",
      quality: 0.95,
    });

    postMessageSafe({
      type: "progress",
      requestId,
      progress: 100,
      message: "Finalizing transparent PNG...",
    });

    postMessageSafe({
      type: "done",
      requestId,
      mode,
      backend: activeBackend,
      blob: resultBlob,
      warning:
        inheritedWarning ??
        modelSession.backendWarning ??
        modelLoadResult.warning ??
        sizeAssessment.warning,
    });
  } finally {
    bitmap.close();
  }
}

async function removeBackground(
  requestId: string,
  input: BackgroundRemovalJobInput,
  postMessageSafe: (message: WorkerResponse) => void,
) {
  try {
    await runBackgroundRemovalPipeline(
      requestId,
      input.file,
      input.mode,
      input.backend,
      input.timeoutMs,
      null,
      postMessageSafe,
    );
  } catch (error) {
    // Decouple hardware-level backend fallback (WebGPU -> WASM CPU) from model-level fallback.
    // We can always fall back to the CPU WASM engine if we are currently running on WebGPU.
    const canFallback =
      input.backend === "webgpu" ||
      (input.mode !== "u2netp" && input.allowFallback);

    if (!canFallback) {
      throw error;
    }

    const primaryMessage =
      error instanceof Error
        ? error.message
        : "Primary background removal model failed.";

    // Produce a human-readable warning instead of exposing raw ORT / WebGPU
    // error strings to the user.
    const isGpuLimitError =
      primaryMessage.includes("storage buffer") ||
      primaryMessage.includes("bad_alloc") ||
      primaryMessage.includes("OrtRun") ||
      primaryMessage.includes("not compatible with BiRefNet") ||
      primaryMessage.includes("shape computation") ||
      primaryMessage.includes("MaxPool") ||
      primaryMessage.includes("ceil");

    const fallbackWarning = isGpuLimitError
      ? "Your GPU doesn't support all operations for this model. " +
        "Used the CPU-based WASM engine instead \u2014 results may be slightly slower."
      : `${input.mode.toUpperCase()} failed: ${primaryMessage}. Switched to CPU engine.`;

    postMessageSafe({
      type: "progress",
      requestId,
      progress: 12,
      message: "Switching to CPU engine...",
    });

    await runBackgroundRemovalPipeline(
      requestId,
      input.file,
      "u2netp",
      "wasm",
      input.timeoutMs,
      fallbackWarning,
      postMessageSafe,
    );
  }
}

self.onmessage = async (
  event: MessageEvent<BackgroundRemovalWorkerRequest>,
) => {
  const request = event.data;
  if (request.type !== "start") {
    return;
  }

  const postMessageSafe = (message: WorkerResponse) => {
    self.postMessage(message);
  };

  try {
    await removeBackground(request.requestId, request.payload, postMessageSafe);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown background removal error.";
    postMessageSafe({
      type: "error",
      requestId: request.requestId,
      error: message,
    });
  }
};
