"use client";

import { BackgroundRemovalOptions } from "@/components/background-removal-options";
import { EnhancementOptions } from "@/components/enhancement-options";
import { ConversionOptions } from "@/components/conversion-options";
import { Header } from "@/components/header";
import { PreviewSection } from "@/components/preview-section";
import { ProcessingState } from "@/components/processing-state";
import { SiteFooter } from "@/components/site-footer";
import { ToolModeSelector } from "@/components/tool-mode-selector";
import { UploadZone, type UploadSelection } from "@/components/upload-zone";
import {
  BACKGROUND_REMOVAL_MODEL_SPECS,
  MODEL_SPECS,
  resolveBackgroundRemovalPresetMode,
  resolvePresetMode,
  type BackgroundRemovalMode,
  type BackgroundRemovalPreset,
  type EnhancementMode,
  type EnhancementPreset,
  type ToolMode,
} from "@/lib/enhancer/models";
import {
  createBackgroundRemovalRuntimePlan,
  createRuntimePlan,
  detectRuntimeCapabilities,
  probeWebGpuLimits,
  type BackgroundRemovalRuntimePlan,
  type GpuLimitsProbe,
  type InferenceBackend,
  type RuntimeCapabilities,
  type RuntimeImageSize,
  type RuntimePlan,
} from "@/lib/enhancer/runtime-plan";
import type {
  BackgroundRemovalWorkerRequest,
  ProcessingMode,
  WorkerResponse,
} from "@/lib/enhancer/worker-protocol";
import { useCallback, useEffect, useRef, useState } from "react";

type AppState = "idle" | "ready" | "processing" | "done";

const DEFAULT_TOOL_MODE: ToolMode = "enhance";
const DEFAULT_ENHANCEMENT_MODE: EnhancementMode = "realesrgan-general-x4v3";
const DEFAULT_ENHANCEMENT_PRESET: EnhancementPreset = "auto";
const DEFAULT_BACKGROUND_REMOVAL_MODE: BackgroundRemovalMode = "u2netp";
const DEFAULT_BACKGROUND_REMOVAL_PRESET: BackgroundRemovalPreset = "auto";
const ENHANCEMENT_WORKER_TIMEOUT_MS = 90_000;
const BACKGROUND_WORKER_TIMEOUT_MS = 120_000;

function resolveModeForPreset(
  preset: EnhancementPreset,
  runtimePlan: RuntimePlan | null,
): EnhancementMode {
  const autoMode = runtimePlan?.mode ?? DEFAULT_ENHANCEMENT_MODE;
  return resolvePresetMode(preset, autoMode);
}

function resolveBackgroundModeForPreset(
  preset: BackgroundRemovalPreset,
  runtimePlan: BackgroundRemovalRuntimePlan | null,
): BackgroundRemovalMode {
  const autoMode = runtimePlan?.mode ?? DEFAULT_BACKGROUND_REMOVAL_MODE;
  return resolveBackgroundRemovalPresetMode(preset, autoMode);
}

function isEnhancementMode(mode: ProcessingMode): mode is EnhancementMode {
  return mode in MODEL_SPECS;
}

function isBackgroundRemovalMode(
  mode: ProcessingMode,
): mode is BackgroundRemovalMode {
  return mode in BACKGROUND_REMOVAL_MODEL_SPECS;
}

function createRequestId() {
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function HomePage() {
  const [state, setState] = useState<AppState>("idle");
  const [toolMode, setToolMode] = useState<ToolMode>(DEFAULT_TOOL_MODE);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [imageSize, setImageSize] = useState<RuntimeImageSize | null>(null);
  const [enhancementMode, setEnhancementMode] = useState<EnhancementMode>(
    DEFAULT_ENHANCEMENT_MODE,
  );
  const [enhancementPreset, setEnhancementPreset] = useState<EnhancementPreset>(
    DEFAULT_ENHANCEMENT_PRESET,
  );
  const [backgroundRemovalMode, setBackgroundRemovalMode] =
    useState<BackgroundRemovalMode>(DEFAULT_BACKGROUND_REMOVAL_MODE);
  const [backgroundRemovalPreset, setBackgroundRemovalPreset] =
    useState<BackgroundRemovalPreset>(DEFAULT_BACKGROUND_REMOVAL_PRESET);
  const [targetFormat, setTargetFormat] = useState<"png" | "jpeg" | "webp" | "avif">("png");
  const [quality, setQuality] = useState<number>(90);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Preparing enhancement...");
  const [runtimeCapabilities, setRuntimeCapabilities] =
    useState<RuntimeCapabilities | null>(null);
  const [runtimePlan, setRuntimePlan] = useState<RuntimePlan | null>(null);
  const [backgroundRemovalRuntimePlan, setBackgroundRemovalRuntimePlan] =
    useState<BackgroundRemovalRuntimePlan | null>(null);
  const [activeBackend, setActiveBackend] = useState<InferenceBackend | null>(
    null,
  );
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const [workerWarning, setWorkerWarning] = useState<string | null>(null);
  const enhanceWorkerRef = useRef<Worker | null>(null);
  const backgroundWorkerRef = useRef<Worker | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const activeToolModeRef = useRef<ToolMode>(DEFAULT_TOOL_MODE);
  const previewUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const gpuLimitsRef = useRef<GpuLimitsProbe | null>(null);
  const [gpuLimitsReady, setGpuLimitsReady] = useState(false);

  const stopWorkers = useCallback(() => {
    if (enhanceWorkerRef.current) {
      enhanceWorkerRef.current.terminate();
      enhanceWorkerRef.current = null;
    }
    if (backgroundWorkerRef.current) {
      backgroundWorkerRef.current.terminate();
      backgroundWorkerRef.current = null;
    }
    activeRequestIdRef.current = null;
  }, []);

  const cancelActiveRequest = useCallback(() => {
    activeRequestIdRef.current = null;
  }, []);

  const revokeObjectUrl = useCallback((url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const updatePreviewUrl = useCallback((nextUrl: string | null) => {
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }, []);

  const updateResultUrl = useCallback((nextUrl: string | null) => {
    resultUrlRef.current = nextUrl;
    setResultUrl(nextUrl);
  }, []);

  const getCurrentRuntimePlans = useCallback(
    (nextImageSize: RuntimeImageSize | null = null) => {
      const capabilities = detectRuntimeCapabilities();
      const nextRuntimePlan = createRuntimePlan(capabilities);
      const nextBackgroundPlan = createBackgroundRemovalRuntimePlan(
        capabilities,
        nextImageSize,
        gpuLimitsRef.current,
      );

      setRuntimeCapabilities(capabilities);
      setRuntimePlan(nextRuntimePlan);
      setBackgroundRemovalRuntimePlan(nextBackgroundPlan);

      return {
        capabilities,
        runtimePlan: nextRuntimePlan,
        backgroundRemovalRuntimePlan: nextBackgroundPlan,
      };
    },
    [],
  );

  const updateActiveRuntimeSummary = useCallback(
    (
      nextToolMode: ToolMode,
      plans: {
        runtimePlan: RuntimePlan;
        backgroundRemovalRuntimePlan: BackgroundRemovalRuntimePlan;
      },
    ) => {
      if (nextToolMode === "convert") {
        setActiveBackend(null);
        setEstimatedTime("Instant");
        return;
      }

      const activePlan =
        nextToolMode === "enhance"
          ? plans.runtimePlan
          : plans.backgroundRemovalRuntimePlan;
      setActiveBackend(activePlan.backend);
      setEstimatedTime(activePlan.expectedTime);
    },
    [],
  );

  const handleWorkerMessage = useCallback(
    (response: WorkerResponse) => {
      if (response.requestId !== activeRequestIdRef.current) {
        return;
      }

      const runningToolMode = activeToolModeRef.current;

      if (response.type === "ready") {
        if (runningToolMode === "enhance" && isEnhancementMode(response.mode)) {
          setEnhancementMode(response.mode);
        }
        if (
          runningToolMode === "remove-background" &&
          isBackgroundRemovalMode(response.mode)
        ) {
          setBackgroundRemovalMode(response.mode);
        }
        setActiveBackend(response.backend);
        setEstimatedTime(response.estimatedTime);
        setWorkerWarning(response.warning);
        return;
      }

      if (response.type === "progress") {
        setProgress(response.progress);
        setStage(response.message);
        return;
      }

      if (response.type === "error") {
        setWorkerWarning(response.error);
        setState("ready");
        setProgress(0);
        cancelActiveRequest();
        return;
      }

      if (response.type === "done") {
        const outputUrl = URL.createObjectURL(response.blob);
        revokeObjectUrl(resultUrlRef.current);
        updateResultUrl(outputUrl);

        if (runningToolMode === "enhance" && isEnhancementMode(response.mode)) {
          setEnhancementMode(response.mode);
        }
        if (
          runningToolMode === "remove-background" &&
          isBackgroundRemovalMode(response.mode)
        ) {
          setBackgroundRemovalMode(response.mode);
        }

        setActiveBackend(response.backend);
        setWorkerWarning(response.warning);
        setProgress(100);
        setStage(
          runningToolMode === "enhance"
            ? "Enhancement complete"
            : "Background removed",
        );
        setState("done");
        cancelActiveRequest();
      }
    },
    [revokeObjectUrl, cancelActiveRequest, updateResultUrl],
  );

  useEffect(() => {
    const plans = getCurrentRuntimePlans(imageSize);
    updateActiveRuntimeSummary(toolMode, plans);
  }, [getCurrentRuntimePlans, gpuLimitsReady, imageSize, toolMode, updateActiveRuntimeSummary]);

  useEffect(() => {
    let cancelled = false;
    probeWebGpuLimits().then((result) => {
      if (!cancelled) {
        gpuLimitsRef.current = result;
        setGpuLimitsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setEnhancementMode(resolveModeForPreset(enhancementPreset, runtimePlan));
  }, [enhancementPreset, runtimePlan]);

  useEffect(() => {
    setBackgroundRemovalMode(
      resolveBackgroundModeForPreset(
        backgroundRemovalPreset,
        backgroundRemovalRuntimePlan,
      ),
    );
  }, [backgroundRemovalPreset, backgroundRemovalRuntimePlan]);

  useEffect(() => {
    return () => {
      stopWorkers();
      revokeObjectUrl(previewUrlRef.current);
      revokeObjectUrl(resultUrlRef.current);
    };
  }, [revokeObjectUrl, stopWorkers]);

  const handleToolModeChange = useCallback(
    (nextToolMode: ToolMode) => {
      if (nextToolMode === toolMode) {
        return;
      }

      cancelActiveRequest();
      revokeObjectUrl(resultUrlRef.current);
      updateResultUrl(null);
      setToolMode(nextToolMode);
      activeToolModeRef.current = nextToolMode;
      setWorkerWarning(null);
      setProgress(0);
      setStage(
        nextToolMode === "enhance"
          ? "Ready to enhance"
          : nextToolMode === "remove-background"
          ? "Ready to remove background"
          : "Ready to convert",
      );

      const plans = getCurrentRuntimePlans(imageSize);
      updateActiveRuntimeSummary(nextToolMode, plans);
      setState(selectedFile ? "ready" : "idle");
    },
    [
      getCurrentRuntimePlans,
      imageSize,
      revokeObjectUrl,
      selectedFile,
      cancelActiveRequest,
      toolMode,
      updateActiveRuntimeSummary,
      updateResultUrl,
    ],
  );

  const handleFileSelected = useCallback(
    (selection: UploadSelection) => {
      const nextImageSize = {
        width: selection.width,
        height: selection.height,
      };

      revokeObjectUrl(previewUrlRef.current);
      revokeObjectUrl(resultUrlRef.current);
      updatePreviewUrl(selection.previewUrl);
      updateResultUrl(null);
      setSelectedFile(selection.file);
      setFileName(selection.file.name);
      setImageSize(nextImageSize);
      setSizeWarning(selection.warning);
      setWorkerWarning(null);
      setProgress(0);
      setStage(
        toolMode === "enhance"
          ? "Ready to enhance"
          : toolMode === "remove-background"
          ? "Ready to remove background"
          : "Ready to convert",
      );

      const plans = getCurrentRuntimePlans(nextImageSize);
      setEnhancementMode(
        resolveModeForPreset(enhancementPreset, plans.runtimePlan),
      );
      setBackgroundRemovalMode(
        resolveBackgroundModeForPreset(
          backgroundRemovalPreset,
          plans.backgroundRemovalRuntimePlan,
        ),
      );
      updateActiveRuntimeSummary(toolMode, plans);
      setState("ready");
    },
    [
      backgroundRemovalPreset,
      enhancementPreset,
      getCurrentRuntimePlans,
      revokeObjectUrl,
      toolMode,
      updateActiveRuntimeSummary,
      updatePreviewUrl,
      updateResultUrl,
    ],
  );

  const startEnhancement = useCallback(() => {
    if (!selectedFile) {
      return;
    }

    const plans = getCurrentRuntimePlans(imageSize);
    const resolvedMode = resolveModeForPreset(
      enhancementPreset,
      plans.runtimePlan,
    );
    const requestId = createRequestId();

    cancelActiveRequest();

    if (!enhanceWorkerRef.current) {
      const worker = new Worker(
        new URL("../workers/enhance.worker.ts", import.meta.url),
      );

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        handleWorkerMessage(event.data);
      };

      worker.onerror = (event) => {
        enhanceWorkerRef.current = null;
        setWorkerWarning(
          event.message
            ? `Worker failed unexpectedly: ${event.message}`
            : "Worker failed unexpectedly. Please try again.",
        );
        setState("ready");
        setProgress(0);
        cancelActiveRequest();
      };

      worker.onmessageerror = () => {
        enhanceWorkerRef.current = null;
        setWorkerWarning("Worker response could not be read. Please try again.");
        setState("ready");
        setProgress(0);
        cancelActiveRequest();
      };

      enhanceWorkerRef.current = worker;
    }

    activeRequestIdRef.current = requestId;
    activeToolModeRef.current = "enhance";

    setProgress(0);
    setStage("Starting worker...");
    setWorkerWarning(null);
    setEstimatedTime(plans.runtimePlan.expectedTime);
    setActiveBackend(plans.runtimePlan.backend);
    setEnhancementMode(resolvedMode);
    setToolMode("enhance");
    setState("processing");

    enhanceWorkerRef.current.postMessage({
      type: "start",
      requestId,
      payload: {
        file: selectedFile,
        mode: resolvedMode,
        backend: plans.runtimePlan.backend,
        timeoutMs: ENHANCEMENT_WORKER_TIMEOUT_MS,
        allowLowQualityFallback: enhancementPreset !== "quality",
      },
    });
  }, [
    enhancementPreset,
    getCurrentRuntimePlans,
    handleWorkerMessage,
    imageSize,
    selectedFile,
    cancelActiveRequest,
  ]);

  const startBackgroundRemoval = useCallback(() => {
    if (!selectedFile) {
      return;
    }

    const plans = getCurrentRuntimePlans(imageSize);
    const resolvedMode = resolveBackgroundModeForPreset(
      backgroundRemovalPreset,
      plans.backgroundRemovalRuntimePlan,
    );
    const requestId = createRequestId();

    if (
      resolvedMode === "birefnet-lite-fp16" &&
      !plans.capabilities.hasWebGPU
    ) {
      setBackgroundRemovalMode("u2netp");
      setBackgroundRemovalPreset("fast");
      setActiveBackend("wasm");
      setEstimatedTime("5-20 sec");
      setWorkerWarning(
        "BiRefNet Lite FP16 requires WebGPU. This browser can run U2Netp instead.",
      );
      return;
    }

    cancelActiveRequest();

    if (!backgroundWorkerRef.current) {
      const worker = new Worker(
        new URL("../workers/remove-background.worker.ts", import.meta.url),
      );

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        handleWorkerMessage(event.data);
      };

      worker.onerror = (event) => {
        backgroundWorkerRef.current = null;
        setWorkerWarning(
          event.message
            ? `Worker failed unexpectedly: ${event.message}`
            : "Worker failed unexpectedly. Please try again.",
        );
        setState("ready");
        setProgress(0);
        cancelActiveRequest();
      };

      worker.onmessageerror = () => {
        backgroundWorkerRef.current = null;
        setWorkerWarning("Worker response could not be read. Please try again.");
        setState("ready");
        setProgress(0);
        cancelActiveRequest();
      };

      backgroundWorkerRef.current = worker;
    }

    activeRequestIdRef.current = requestId;
    activeToolModeRef.current = "remove-background";

    setProgress(0);
    setStage("Starting worker...");
    setWorkerWarning(null);
    setEstimatedTime(plans.backgroundRemovalRuntimePlan.expectedTime);
    setActiveBackend(plans.backgroundRemovalRuntimePlan.backend);
    setBackgroundRemovalMode(resolvedMode);
    setToolMode("remove-background");
    setState("processing");

    const request: BackgroundRemovalWorkerRequest = {
      type: "start",
      requestId,
      payload: {
        file: selectedFile,
        mode: resolvedMode,
        backend: plans.backgroundRemovalRuntimePlan.backend,
        timeoutMs: BACKGROUND_WORKER_TIMEOUT_MS,
        allowFallback: true,
      },
    };

    backgroundWorkerRef.current.postMessage(request);
  }, [
    backgroundRemovalPreset,
    getCurrentRuntimePlans,
    handleWorkerMessage,
    imageSize,
    selectedFile,
    cancelActiveRequest,
  ]);

  const startConversion = useCallback(() => {
    if (!selectedFile) {
      return;
    }

    const targetMime = `image/${targetFormat === "jpeg" ? "jpeg" : targetFormat}`;
    const extension = targetFormat === "jpeg" ? "jpg" : targetFormat;
    const requestId = createRequestId();
    
    cancelActiveRequest();

    activeRequestIdRef.current = requestId;
    activeToolModeRef.current = "convert";

    setProgress(0);
    setStage("Starting conversion...");
    setWorkerWarning(null);
    setToolMode("convert");
    setState("processing");

    const img = new window.Image();
    img.src = previewUrl || "";

    img.onload = () => {
      if (activeRequestIdRef.current !== requestId) return;
      
      setProgress(30);
      setStage("Drawing to canvas...");

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        setWorkerWarning("Could not create 2D canvas context.");
        setState("ready");
        setProgress(0);
        cancelActiveRequest();
        return;
      }

      if (targetFormat === "jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      
      setProgress(60);
      setStage("Encoding image...");

      const qualityValue = (targetFormat === "jpeg" || targetFormat === "webp")
        ? quality / 100
        : undefined;

      canvas.toBlob(
        (blob) => {
          if (activeRequestIdRef.current !== requestId) return;
          if (!blob) {
            setWorkerWarning("Image conversion failed. The format might be unsupported in this browser.");
            setState("ready");
            setProgress(0);
            cancelActiveRequest();
            return;
          }

          setProgress(100);
          setStage("Conversion complete");

          const outputUrl = URL.createObjectURL(blob);
          revokeObjectUrl(resultUrlRef.current);
          updateResultUrl(outputUrl);

          const lastDotIndex = fileName.lastIndexOf(".");
          const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
          setFileName(`${baseName}.${extension}`);

          setState("done");
          cancelActiveRequest();
        },
        targetMime,
        qualityValue
      );
    };

    img.onerror = () => {
      if (activeRequestIdRef.current !== requestId) return;
      setWorkerWarning("Failed to load image preview for conversion.");
      setState("ready");
      setProgress(0);
      cancelActiveRequest();
    };
  }, [selectedFile, previewUrl, targetFormat, quality, fileName, revokeObjectUrl, updateResultUrl, cancelActiveRequest]);

  const handleCancel = useCallback(() => {
    cancelActiveRequest();
    setProgress(0);
    setStage("Cancelled");
    setWorkerWarning(
      toolMode === "enhance"
        ? "Enhancement cancelled."
        : "Background removal cancelled.",
    );
    setState("ready");
  }, [cancelActiveRequest, toolMode]);

  const handleReset = useCallback(() => {
    cancelActiveRequest();
    revokeObjectUrl(previewUrlRef.current);
    revokeObjectUrl(resultUrlRef.current);
    updatePreviewUrl(null);
    updateResultUrl(null);
    setSelectedFile(null);
    setFileName("");
    setImageSize(null);
    setProgress(0);
    setStage(
      toolMode === "enhance"
        ? "Preparing enhancement..."
        : toolMode === "remove-background"
        ? "Preparing background removal..."
        : "Preparing conversion...",
    );
    setSizeWarning(null);
    setWorkerWarning(null);
    setEnhancementPreset(DEFAULT_ENHANCEMENT_PRESET);
    setBackgroundRemovalPreset(DEFAULT_BACKGROUND_REMOVAL_PRESET);
    setTargetFormat("png");
    setQuality(90);

    const plans = getCurrentRuntimePlans(null);
    setEnhancementMode(
      resolveModeForPreset(DEFAULT_ENHANCEMENT_PRESET, plans.runtimePlan),
    );
    setBackgroundRemovalMode(
      resolveBackgroundModeForPreset(
        DEFAULT_BACKGROUND_REMOVAL_PRESET,
        plans.backgroundRemovalRuntimePlan,
      ),
    );
    updateActiveRuntimeSummary(toolMode, plans);
    setState("idle");
  }, [
    getCurrentRuntimePlans,
    revokeObjectUrl,
    cancelActiveRequest,
    toolMode,
    updateActiveRuntimeSummary,
    updatePreviewUrl,
    updateResultUrl,
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent"
      />
      <Header onReset={handleReset} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center p-4 sm:p-6 lg:py-8">
        <div className="w-full max-w-7xl space-y-4 transition-all duration-500 sm:space-y-5 ">
          <ToolModeSelector
            value={toolMode}
            disabled={state === "processing"}
            onChange={handleToolModeChange}
          />

          {state === "idle" && (
            <UploadZone
              toolMode={toolMode}
              onFileSelected={handleFileSelected}
            />
          )}

          {state === "ready" &&
            previewUrl &&
            (toolMode === "enhance" ? (
              <EnhancementOptions
                previewUrl={previewUrl}
                fileName={fileName}
                mode={enhancementMode}
                preset={enhancementPreset}
                runtimePlan={runtimePlan}
                capabilities={runtimeCapabilities}
                sizeWarning={sizeWarning}
                workerWarning={workerWarning}
                onPresetChange={setEnhancementPreset}
                onEnhance={startEnhancement}
                onFileSelected={handleFileSelected}
              />
            ) : toolMode === "remove-background" ? (
              <BackgroundRemovalOptions
                previewUrl={previewUrl}
                fileName={fileName}
                mode={backgroundRemovalMode}
                preset={backgroundRemovalPreset}
                runtimePlan={backgroundRemovalRuntimePlan}
                capabilities={runtimeCapabilities}
                sizeWarning={sizeWarning}
                workerWarning={workerWarning}
                onPresetChange={setBackgroundRemovalPreset}
                onRemoveBackground={startBackgroundRemoval}
                onFileSelected={handleFileSelected}
              />
            ) : (
              <ConversionOptions
                previewUrl={previewUrl}
                fileName={fileName}
                targetFormat={targetFormat}
                quality={quality}
                sizeWarning={sizeWarning}
                workerWarning={workerWarning}
                onFormatChange={setTargetFormat}
                onQualityChange={setQuality}
                onConvert={startConversion}
                onFileSelected={handleFileSelected}
              />
            ))}

          {state === "processing" && (
            <ProcessingState
              toolMode={toolMode}
              progress={progress}
              stage={stage}
              backend={activeBackend}
              estimatedTime={estimatedTime}
              onCancel={handleCancel}
            />
          )}

          {state === "done" && previewUrl && resultUrl && (
            <PreviewSection
              toolMode={toolMode}
              originalUrl={previewUrl}
              resultUrl={resultUrl}
              enhancementMode={enhancementMode}
              backgroundRemovalMode={backgroundRemovalMode}
              workerWarning={workerWarning}
              fileName={fileName}
              onReset={handleReset}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
