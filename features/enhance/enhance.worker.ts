import { clampToByte, imageBitmapFromFile } from "@/shared/image/pixels";
import { assessImageDimensions } from "@/shared/image/image-size";
import { buildTileGrid } from "@/shared/image/tiling";
import {
  BACKEND_LABELS,
  type InferenceBackend,
} from "@/shared/inference/backend";
import { loadModelBufferWithCache } from "@/shared/inference/model-cache";
import {
  getInputMetadata,
  getOrtModule,
  getSessionIO,
  resolveFixedDimension,
  type OrtModule,
  type OrtSession,
} from "@/shared/inference/ort";
import type { JobOutcome, ReportProgress } from "@/shared/worker-job/protocol";
import { serveJobs } from "@/shared/worker-job/serve-jobs";
import {
  ENHANCEMENT_MODELS,
  type EnhanceInput,
  type EnhanceResult,
  type EnhancementMode,
} from "./models";

const TILE_SIZE = 512;

interface SessionBundle {
  module: OrtModule;
  session: OrtSession;
  inputName: string;
  outputName: string;
  inputChannels: number;
  fixedInputWidth: number | null;
  fixedInputHeight: number | null;
  activeBackend: InferenceBackend;
  backendWarning: string | null;
}

const sessionCache = new Map<string, SessionBundle>();

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

function resizeImageData(imageData: ImageData, width: number, height: number) {
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
  const buildSession = (backend: InferenceBackend) =>
    ort.InferenceSession.create(modelBuffer, {
      executionProviders: [backend],
      graphOptimizationLevel: "all",
    });

  let session: OrtSession;
  let activeBackend = requestedBackend;
  let backendWarning: string | null = null;

  try {
    session = await buildSession(requestedBackend);
  } catch {
    if (requestedBackend === "wasm") {
      throw new Error("Failed to initialize ONNX session on WASM backend.");
    }

    session = await buildSession("wasm");
    activeBackend = "wasm";
    backendWarning = `Requested ${BACKEND_LABELS[requestedBackend]} backend is unavailable for this model. Switched to WASM.`;
  }

  const { inputName, outputName } = getSessionIO(session);
  const shape = getInputMetadata(session, inputName)?.shape ?? [];
  const channels = shape[1];

  const bundle: SessionBundle = {
    module: ort,
    session,
    inputName,
    outputName,
    inputChannels:
      typeof channels === "number" && Number.isFinite(channels) ? channels : 3,
    fixedInputWidth: resolveFixedDimension(shape[3]),
    fixedInputHeight: resolveFixedDimension(shape[2]),
    activeBackend,
    backendWarning,
  };

  sessionCache.set(cacheKey, bundle);
  if (activeBackend !== requestedBackend) {
    sessionCache.set(`${activeBackend}:${mode}`, bundle);
  }

  return bundle;
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

        for (
          let ny = Math.max(0, y - 1);
          ny <= Math.min(height - 1, y + 1);
          ny += 1
        ) {
          for (
            let nx = Math.max(0, x - 1);
            nx <= Math.min(width - 1, x + 1);
            nx += 1
          ) {
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
  file: File,
  mode: EnhancementMode,
  backend: InferenceBackend,
  softTimeoutMs: number,
  inheritedWarning: string | null,
  report: ReportProgress,
): Promise<{ timedOut: false; result: EnhanceResult } | { timedOut: true }> {
  const bitmap = await imageBitmapFromFile(file);
  try {
    const sizeAssessment = assessImageDimensions(bitmap.width, bitmap.height);
    if (sizeAssessment.blockingError) {
      throw new Error(sizeAssessment.blockingError);
    }

    const selectedSpec = ENHANCEMENT_MODELS[mode];
    report(1, `Loading ${selectedSpec.label}...`);
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

    report(
      2,
      `Model ready on ${BACKEND_LABELS[activeBackend]} (${getExpectedTime(activeBackend, mode)})`,
    );

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

    report(3, "Preparing tiles...");

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
      if (elapsed > softTimeoutMs && activeBackend === "wasm") {
        return { timedOut: true };
      }

      const nextProgress = Math.max(
        4,
        Math.min(98, Math.round(((index + 1) / totalTiles) * 95)),
      );

      report(nextProgress, `Processing tile ${index + 1}/${totalTiles}`);
    }

    const resultBlob = await outputCanvas.convertToBlob({
      type: "image/png",
      quality: 0.95,
    });

    report(100, "Finalizing image...");

    return {
      timedOut: false,
      result: {
        blob: resultBlob,
        mode,
        backend: activeBackend,
        warning:
          inheritedWarning ??
          onnxWarning ??
          modelLoadResult.warning ??
          sizeAssessment.warning,
      },
    };
  } finally {
    bitmap.close();
  }
}

function failure(message: string): JobOutcome<EnhanceResult> {
  return { ok: false, error: { code: "timed-out", message } };
}

async function enhanceImage(
  input: EnhanceInput,
  report: ReportProgress,
): Promise<JobOutcome<EnhanceResult>> {
  const primary = await runEnhancementPipeline(
    input.file,
    input.mode,
    input.backend,
    input.softTimeoutMs,
    null,
    report,
  );
  if (!primary.timedOut) {
    return { ok: true, value: primary.result };
  }

  if (input.mode === "super-resolution-lite") {
    return failure("Fast mode timed out on WASM. Try a smaller image.");
  }
  if (!input.allowLowQualityFallback) {
    return failure(
      "Enhancement timed out. Try a smaller image or choose Fast mode.",
    );
  }

  const fallback = await runEnhancementPipeline(
    input.file,
    "super-resolution-lite",
    input.backend,
    input.softTimeoutMs,
    "Primary model timed out. Switched to Fast mode (Super-Resolution Lite).",
    report,
  );
  if (fallback.timedOut) {
    return failure(
      "Fallback model also timed out. Please try a smaller image.",
    );
  }
  return { ok: true, value: fallback.result };
}

serveJobs(self, enhanceImage);
