/// <reference lib="webworker" />

import { assessImageDimensions } from "@/lib/enhancer/image-size";
import { loadModelBufferWithCache } from "@/lib/enhancer/model-cache";
import { MODEL_SPECS, type EnhancementMode } from "@/lib/enhancer/models";
import type { InferenceBackend } from "@/lib/enhancer/runtime-plan";
import { buildTileGrid } from "@/lib/enhancer/tiling";
import type {
  EnhancementJobInput,
  WorkerRequest,
  WorkerResponse,
} from "@/lib/enhancer/worker-protocol";

const TILE_SIZE = 512;
const ORT_ASSET_BASE_PATH = "/ort/";

type OrtModule = typeof import("onnxruntime-web/all");

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
  inputChannels: number;
  fixedInputWidth: number | null;
  fixedInputHeight: number | null;
  activeBackend: InferenceBackend;
  backendWarning: string | null;
}

const sessionCache = new Map<string, SessionBundle>();
let ortModulePromise: Promise<OrtModule> | null = null;
let ortConfigured = false;

function getExpectedTime(backend: InferenceBackend, mode: EnhancementMode) {
  if (backend === "webgpu" && mode === "real-esrgan-x4") {
    return "4-12 sec";
  }
  if (backend === "webgpu" && mode === "realesrgan-general-x4v3") {
    return "3-10 sec";
  }
  if (backend === "webgl" && mode === "realesrgan-general-x4v3") {
    return "10-25 sec";
  }
  if (backend === "wasm" && mode === "realesrgan-general-x4v3") {
    return "30-90 sec";
  }
  if (mode === "super-resolution-lite") {
    return backend === "wasm" ? "20-60 sec" : "5-15 sec";
  }
  return "5-15 sec";
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

function clampToByte(value: number) {
  if (value <= 0) {
    return 0;
  }
  if (value >= 255) {
    return 255;
  }
  return Math.round(value);
}

function rgbToCb(r: number, g: number, b: number) {
  return -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
}

function rgbToCr(r: number, g: number, b: number) {
  return 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
}

function yCbCrToRgb(y: number, cb: number, cr: number) {
  const cbOffset = cb - 128;
  const crOffset = cr - 128;

  return {
    r: clampToByte(y + 1.402 * crOffset),
    g: clampToByte(y - 0.344136 * cbOffset - 0.714136 * crOffset),
    b: clampToByte(y + 1.772 * cbOffset),
  };
}

function resizeImageData(
  imageData: ImageData,
  width: number,
  height: number,
) {
  const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("Unable to create chroma source context.");
  }
  sourceContext.putImageData(imageData, 0, 0);

  const targetCanvas = new OffscreenCanvas(width, height);
  const targetContext = targetCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!targetContext) {
    throw new Error("Unable to create chroma target context.");
  }
  targetContext.imageSmoothingEnabled = true;
  targetContext.imageSmoothingQuality = "high";
  targetContext.drawImage(sourceCanvas, 0, 0, width, height);

  return targetContext.getImageData(0, 0, width, height);
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
    ortModule.env.wasm.wasmPaths = ORT_ASSET_BASE_PATH;
    ortModule.env.wasm.proxy = false;
    ortModule.env.wasm.numThreads = 1;
    ortConfigured = true;
  }

  return ortModule;
}

async function createSessionBundle(
  mode: EnhancementMode,
  requestedBackend: InferenceBackend,
  modelBuffer: ArrayBuffer,
): Promise<SessionBundle> {
  const cacheKey = `${requestedBackend}:${mode}`;
  const cachedSession = sessionCache.get(cacheKey);
  if (cachedSession) {
    return cachedSession;
  }

  const ort = await getOrtModule();
  const preferredExecutionProvider = getExecutionProvider(requestedBackend);

  const buildSession = async (executionProvider: string) => {
    return ort.InferenceSession.create(modelBuffer, {
      executionProviders: [executionProvider],
      graphOptimizationLevel: "all",
    });
  };

  let session: Awaited<
    ReturnType<OrtModule["InferenceSession"]["create"]>
  > | null = null;
  let activeBackend = requestedBackend;
  let backendWarning: string | null = null;

  try {
    session = await buildSession(preferredExecutionProvider);
  } catch {
    if (requestedBackend === "wasm") {
      throw new Error("Failed to initialize ONNX session on WASM backend.");
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
  const inputChannels =
    typeof shape[1] === "number" && Number.isFinite(shape[1])
      ? (shape[1] as number)
      : 3;
  const fixedInputHeight = resolveFixedDimension(shape[2]);
  const fixedInputWidth = resolveFixedDimension(shape[3]);

  const bundle: SessionBundle = {
    module: ort,
    session,
    inputName,
    outputName,
    inputChannels,
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
  modelInputWidth: number,
  modelInputHeight: number,
  inputChannels: number,
) {
  if (inputChannels === 1) {
    const tensorData = new Float32Array(modelInputWidth * modelInputHeight);

    for (let y = 0; y < modelInputHeight; y += 1) {
      for (let x = 0; x < modelInputWidth; x += 1) {
        const sourceX = Math.min(imageData.width - 1, x);
        const sourceY = Math.min(imageData.height - 1, y);
        const pixelIndex = (sourceY * imageData.width + sourceX) * 4;
        const r = imageData.data[pixelIndex];
        const g = imageData.data[pixelIndex + 1];
        const b = imageData.data[pixelIndex + 2];
        const grayscale = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        tensorData[y * modelInputWidth + x] = grayscale;
      }
    }

    return new ort.Tensor("float32", tensorData, [
      1,
      1,
      modelInputHeight,
      modelInputWidth,
    ]);
  }

  const planeSize = modelInputWidth * modelInputHeight;
  const tensorData = new Float32Array(planeSize * 3);

  for (let y = 0; y < modelInputHeight; y += 1) {
    for (let x = 0; x < modelInputWidth; x += 1) {
      const sourceX = Math.min(imageData.width - 1, x);
      const sourceY = Math.min(imageData.height - 1, y);
      const pixelIndex = (sourceY * imageData.width + sourceX) * 4;
      const position = y * modelInputWidth + x;

      tensorData[position] = imageData.data[pixelIndex] / 255;
      tensorData[planeSize + position] = imageData.data[pixelIndex + 1] / 255;
      tensorData[planeSize * 2 + position] =
        imageData.data[pixelIndex + 2] / 255;
    }
  }

  return new ort.Tensor("float32", tensorData, [
    1,
    3,
    modelInputHeight,
    modelInputWidth,
  ]);
}

function fillTransparentPixels(imageData: ImageData, passes = 2) {
  const { width, height } = imageData;
  let source = new Uint8ClampedArray(imageData.data);
  let target = new Uint8ClampedArray(imageData.data);

  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        if (source[index + 3] !== 0) {
          continue;
        }

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
            const neighborIndex = (ny * width + nx) * 4;
            if (source[neighborIndex + 3] === 0) {
              continue;
            }
            r += source[neighborIndex];
            g += source[neighborIndex + 1];
            b += source[neighborIndex + 2];
            count += 1;
          }
        }

        if (count > 0) {
          target[index] = Math.round(r / count);
          target[index + 1] = Math.round(g / count);
          target[index + 2] = Math.round(b / count);
        }
      }
    }

    const swap = source;
    source = target;
    target = swap;
  }

  return new ImageData(source, width, height);
}

function applyAlphaAndEdgeBlend(
  imageData: ImageData,
  alphaSource: ImageData | null,
) {
  const targetData = imageData.data;

  if (!alphaSource) {
    for (let i = 3; i < targetData.length; i += 4) {
      targetData[i] = 255;
    }
    return;
  }

  const sourceData = alphaSource.data;
  for (let i = 0; i < targetData.length; i += 4) {
    const alphaByte = sourceData[i + 3];
    const alpha = alphaByte / 255;

    if (alpha < 1) {
      const inv = 1 - alpha;
      targetData[i] = Math.round(targetData[i] * alpha + sourceData[i] * inv);
      targetData[i + 1] = Math.round(
        targetData[i + 1] * alpha + sourceData[i + 1] * inv,
      );
      targetData[i + 2] = Math.round(
        targetData[i + 2] * alpha + sourceData[i + 2] * inv,
      );
    }

    targetData[i + 3] = alphaByte;
  }
}

function tensorToImageData(
  tensorData: Float32Array,
  dims: readonly number[],
  outputWidth: number,
  outputHeight: number,
  sourceImageData?: ImageData,
) {
  const alphaSource = sourceImageData
    ? sourceImageData.width === outputWidth &&
      sourceImageData.height === outputHeight
      ? sourceImageData
      : resizeImageData(sourceImageData, outputWidth, outputHeight)
    : null;
  const channels = dims.length >= 2 ? dims[1] : 3;
  const imageData = new ImageData(outputWidth, outputHeight);
  const area = outputWidth * outputHeight;

  if (channels === 1) {
    const chromaImageData = alphaSource;

    for (let i = 0; i < area; i += 1) {
      const value = clampToByte(tensorData[i] * 255);
      const pixelIndex = i * 4;

      if (chromaImageData) {
        const sourceR = chromaImageData.data[pixelIndex];
        const sourceG = chromaImageData.data[pixelIndex + 1];
        const sourceB = chromaImageData.data[pixelIndex + 2];
        const rgb = yCbCrToRgb(
          value,
          rgbToCb(sourceR, sourceG, sourceB),
          rgbToCr(sourceR, sourceG, sourceB),
        );
        imageData.data[pixelIndex] = rgb.r;
        imageData.data[pixelIndex + 1] = rgb.g;
        imageData.data[pixelIndex + 2] = rgb.b;
      } else {
        imageData.data[pixelIndex] = value;
        imageData.data[pixelIndex + 1] = value;
        imageData.data[pixelIndex + 2] = value;
      }
    }
    applyAlphaAndEdgeBlend(imageData, alphaSource);
    return imageData;
  }

  for (let i = 0; i < area; i += 1) {
    const r = clampToByte(tensorData[i] * 255);
    const g = clampToByte(tensorData[area + i] * 255);
    const b = clampToByte(tensorData[area * 2 + i] * 255);
    const pixelIndex = i * 4;

    imageData.data[pixelIndex] = r;
    imageData.data[pixelIndex + 1] = g;
    imageData.data[pixelIndex + 2] = b;
  }

  applyAlphaAndEdgeBlend(imageData, alphaSource);

  return imageData;
}

async function runModelOnTile(
  sourceContext: OffscreenCanvasRenderingContext2D,
  sessionBundle: SessionBundle,
  region: { x: number; y: number; width: number; height: number },
) {
  const inputWidth = sessionBundle.fixedInputWidth ?? region.width;
  const inputHeight = sessionBundle.fixedInputHeight ?? region.height;

  if (inputWidth <= 0 || inputHeight <= 0) {
    throw new Error("Invalid model input shape.");
  }

  const tileImageData = sourceContext.getImageData(
    region.x,
    region.y,
    region.width,
    region.height,
  );

  const modelInputImageData = fillTransparentPixels(tileImageData);
  const inputTensor = createInputTensorFromImageData(
    sessionBundle.module,
    modelInputImageData,
    inputWidth,
    inputHeight,
    sessionBundle.inputChannels,
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

    const rawOutputData = outputTensor.data;
    if (!(rawOutputData instanceof Float32Array)) {
      throw new Error(
        "Unexpected output tensor type. Expected float32 output.",
      );
    }

    const outputDims = outputTensor.dims;
    const outputHeight = outputDims[2];
    const outputWidth = outputDims[3];
    if (!outputWidth || !outputHeight) {
      throw new Error("Output tensor has invalid shape.");
    }

    const outputImageData = tensorToImageData(
      rawOutputData,
      outputDims,
      outputWidth,
      outputHeight,
      tileImageData,
    );

    const modelScaleX = outputWidth / inputWidth;
    const modelScaleY = outputHeight / inputHeight;

    return {
      imageData: outputImageData,
      modelScaleX,
      modelScaleY,
    };
  } finally {
    if ("dispose" in inputTensor && typeof inputTensor.dispose === "function") {
      inputTensor.dispose();
    }
    if (outputTensor && typeof outputTensor.dispose === "function") {
      outputTensor.dispose();
    }
  }
}

async function processTile(
  sourceContext: OffscreenCanvasRenderingContext2D,
  outputContext: OffscreenCanvasRenderingContext2D,
  region: { x: number; y: number; width: number; height: number },
  scale: number,
  fallbackFilter: string,
) {
  const tileCanvas = new OffscreenCanvas(region.width, region.height);
  const tileCtx = tileCanvas.getContext("2d", {
    willReadFrequently: false,
  });

  if (!tileCtx) {
    throw new Error("Unable to create source tile context.");
  }

  tileCtx.drawImage(
    sourceContext.canvas,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height,
  );

  const targetWidth = region.width * scale;
  const targetHeight = region.height * scale;
  const upscaledTileCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const upscaledTileCtx = upscaledTileCanvas.getContext("2d");
  if (!upscaledTileCtx) {
    throw new Error("Unable to create target tile context.");
  }

  upscaledTileCtx.imageSmoothingEnabled = true;
  upscaledTileCtx.imageSmoothingQuality = "high";
  upscaledTileCtx.filter = fallbackFilter;
  upscaledTileCtx.drawImage(tileCanvas, 0, 0, targetWidth, targetHeight);

  outputContext.drawImage(
    upscaledTileCanvas,
    region.x * scale,
    region.y * scale,
    targetWidth,
    targetHeight,
  );
}

async function runEnhancementPipeline(
  requestId: string,
  file: File,
  mode: EnhancementMode,
  backend: InferenceBackend,
  timeoutMs: number,
  inheritedWarning: string | null,
  postMessageSafe: (message: WorkerResponse) => void,
): Promise<
  | {
      done: true;
      mode: EnhancementMode;
      backend: InferenceBackend;
      blob: Blob;
      warning: string | null;
      usedOnnxInference: boolean;
      timedOut: false;
    }
  | {
      done: false;
      timedOut: true;
      sizeWarning: string | null;
      modelWarning: string | null;
    }
> {
  const bitmap = await imageBitmapFromFile(file);
  try {
    const sizeAssessment = assessImageDimensions(bitmap.width, bitmap.height);
    if (sizeAssessment.blockingError) {
      throw new Error(sizeAssessment.blockingError);
    }

    const selectedSpec = MODEL_SPECS[mode];
    const modelLoadResult = await loadModelBufferWithCache(selectedSpec.url);
    let modelSession: SessionBundle | null = null;
    let activeBackend = backend;
    let onnxWarning: string | null = null;

    if (modelLoadResult.buffer) {
      try {
        modelSession = await createSessionBundle(
          mode,
          backend,
          modelLoadResult.buffer,
        );
        activeBackend = modelSession.activeBackend;
        onnxWarning = modelSession.backendWarning;
      } catch (error) {
        modelSession = null;
        onnxWarning =
          error instanceof Error
            ? `ONNX session init failed: ${error.message}. Using fallback enhancement path.`
            : "ONNX session init failed. Using fallback enhancement path.";
      }
    }

    postMessageSafe({
      type: "ready",
      requestId,
      mode,
      backend: activeBackend,
      estimatedTime: getExpectedTime(activeBackend, mode),
      modelCached: modelLoadResult.cached,
      usingFallback: modelLoadResult.buffer === null || modelSession === null,
      warning:
        inheritedWarning ??
        onnxWarning ??
        modelLoadResult.warning ??
        sizeAssessment.warning,
    });

    const sourceCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) {
      throw new Error("Unable to create source canvas context.");
    }

    sourceContext.drawImage(bitmap, 0, 0);

    const tileInputWidth =
      modelSession?.fixedInputWidth ?? selectedSpec.fallbackTileSize;
    const tileInputHeight =
      modelSession?.fixedInputHeight ?? selectedSpec.fallbackTileSize;
    const tileGridSize = Math.min(
      TILE_SIZE,
      Math.max(1, Math.min(tileInputWidth, tileInputHeight)),
    );

    const tiles = buildTileGrid(bitmap.width, bitmap.height, tileGridSize);
    const firstTile = tiles[0];
    if (!firstTile) {
      throw new Error("No tiles generated for input image.");
    }

    let dynamicScaleX = selectedSpec.scale;
    let dynamicScaleY = selectedSpec.scale;

    let firstTileOutput: Awaited<ReturnType<typeof runModelOnTile>> | null =
      null;

    if (modelSession) {
      const sampleOutput = await runModelOnTile(
        sourceContext,
        modelSession,
        firstTile,
      );
      dynamicScaleX = Math.max(1, Math.round(sampleOutput.modelScaleX));
      dynamicScaleY = Math.max(1, Math.round(sampleOutput.modelScaleY));
      firstTileOutput = sampleOutput;
    }

    const outputCanvas = new OffscreenCanvas(
      bitmap.width * dynamicScaleX,
      bitmap.height * dynamicScaleY,
    );
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
      throw new Error("Unable to create output canvas context.");
    }

    const totalTiles = tiles.length;
    const startedAt = performance.now();

    postMessageSafe({
      type: "progress",
      requestId,
      progress: 3,
      message: "Preparing tiles...",
    });

    for (let index = 0; index < totalTiles; index += 1) {
      const tile = tiles[index];

      if (modelSession) {
        const modelOutput =
          index === 0 && firstTileOutput
            ? firstTileOutput
            : await runModelOnTile(sourceContext, modelSession, tile);
        const scaledWidth = Math.max(
          1,
          Math.round(tile.width * modelOutput.modelScaleX),
        );
        const scaledHeight = Math.max(
          1,
          Math.round(tile.height * modelOutput.modelScaleY),
        );
        const drawX = Math.round(tile.x * modelOutput.modelScaleX);
        const drawY = Math.round(tile.y * modelOutput.modelScaleY);

        const fullTileCanvas = new OffscreenCanvas(
          modelOutput.imageData.width,
          modelOutput.imageData.height,
        );
        const fullTileContext = fullTileCanvas.getContext("2d");
        if (!fullTileContext) {
          throw new Error("Unable to create model tile canvas.");
        }
        fullTileContext.putImageData(modelOutput.imageData, 0, 0);

        outputContext.drawImage(
          fullTileCanvas,
          0,
          0,
          scaledWidth,
          scaledHeight,
          drawX,
          drawY,
          scaledWidth,
          scaledHeight,
        );
      } else {
        await processTile(
          sourceContext,
          outputContext,
          tile,
          selectedSpec.scale,
          selectedSpec.fallbackFilter,
        );
      }

      const elapsed = performance.now() - startedAt;
      if (elapsed > timeoutMs && activeBackend === "wasm") {
        return {
          done: false,
          timedOut: true,
          sizeWarning: sizeAssessment.warning,
          modelWarning: modelLoadResult.warning,
        };
      }

      const nextProgress = Math.max(
        4,
        Math.min(98, Math.round(((index + 1) / totalTiles) * 95)),
      );

      postMessageSafe({
        type: "progress",
        requestId,
        progress: nextProgress,
        message: `Processing tile ${index + 1}/${totalTiles}`,
      });
    }

    const resultBlob = await outputCanvas.convertToBlob({
      type: "image/png",
      quality: 0.95,
    });

    postMessageSafe({
      type: "progress",
      requestId,
      progress: 100,
      message: "Finalizing image...",
    });

    postMessageSafe({
      type: "done",
      requestId,
      mode,
      backend: activeBackend,
      blob: resultBlob,
      warning:
        inheritedWarning ??
        onnxWarning ??
        modelLoadResult.warning ??
        sizeAssessment.warning,
    });

    return {
      done: true,
      mode,
      backend: activeBackend,
      blob: resultBlob,
      warning:
        inheritedWarning ??
        onnxWarning ??
        modelLoadResult.warning ??
        sizeAssessment.warning,
      usedOnnxInference: modelSession !== null,
      timedOut: false,
    };
  } finally {
    bitmap.close();
  }
}

async function enhanceImage(
  requestId: string,
  input: EnhancementJobInput,
  postMessageSafe: (message: WorkerResponse) => void,
) {
  const primaryResult = await runEnhancementPipeline(
    requestId,
    input.file,
    input.mode,
    input.backend,
    input.timeoutMs,
    null,
    postMessageSafe,
  );

  if (primaryResult.done) {
    return;
  }

  if (input.mode === "super-resolution-lite") {
    throw new Error("Fast mode timed out on WASM. Try a smaller image.");
  }

  if (!input.allowLowQualityFallback) {
    throw new Error(
      "Enhancement timed out. Try a smaller image or choose Fast mode.",
    );
  }

  const fallbackWarning =
    "Primary model timed out. Switched to Fast mode (Super-Resolution Lite).";

  const fallbackResult = await runEnhancementPipeline(
    requestId,
    input.file,
    "super-resolution-lite",
    input.backend,
    input.timeoutMs,
    fallbackWarning,
    postMessageSafe,
  );

  if (!fallbackResult.done) {
    throw new Error(
      "Fallback model also timed out. Please try a smaller image.",
    );
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type !== "start") {
    return;
  }

  const postMessageSafe = (message: WorkerResponse) => {
    self.postMessage(message);
  };

  try {
    await enhanceImage(request.requestId, request.payload, postMessageSafe);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown enhancement error.";
    postMessageSafe({
      type: "error",
      requestId: request.requestId,
      error: message,
    });
  }
};
