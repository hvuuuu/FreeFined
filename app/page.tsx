"use client";

import { EnhancementOptions } from "@/components/enhancement-options";
import { Header } from "@/components/header";
import { PreviewSection } from "@/components/preview-section";
import { ProcessingState } from "@/components/processing-state";
import { SiteFooter } from "@/components/site-footer";
import { UploadZone, type UploadSelection } from "@/components/upload-zone";
import {
  resolvePresetMode,
  type EnhancementMode,
  type EnhancementPreset,
} from "@/lib/enhancer/models";
import {
  createRuntimePlan,
  detectRuntimeCapabilities,
  type InferenceBackend,
  type RuntimeCapabilities,
  type RuntimePlan,
} from "@/lib/enhancer/runtime-plan";
import type { WorkerResponse } from "@/lib/enhancer/worker-protocol";
import { useCallback, useEffect, useRef, useState } from "react";

type AppState = "idle" | "ready" | "processing" | "done";

const DEFAULT_MODE: EnhancementMode = "realesrgan-general-x4v3";
const DEFAULT_PRESET: EnhancementPreset = "auto";
const WORKER_TIMEOUT_MS = 90_000;

function resolveModeForPreset(
  preset: EnhancementPreset,
  runtimePlan: RuntimePlan | null,
): EnhancementMode {
  const autoMode = runtimePlan?.mode ?? DEFAULT_MODE;
  return resolvePresetMode(preset, autoMode);
}

export default function HomePage() {
  const [state, setState] = useState<AppState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<EnhancementMode>(DEFAULT_MODE);
  const [preset, setPreset] = useState<EnhancementPreset>(DEFAULT_PRESET);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Preparing enhancement...");
  const [runtimeCapabilities, setRuntimeCapabilities] =
    useState<RuntimeCapabilities | null>(null);
  const [runtimePlan, setRuntimePlan] = useState<RuntimePlan | null>(null);
  const [activeBackend, setActiveBackend] = useState<InferenceBackend | null>(
    null,
  );
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const [workerWarning, setWorkerWarning] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const enhancedUrlRef = useRef<string | null>(null);

  const stopWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
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

  const updateEnhancedUrl = useCallback((nextUrl: string | null) => {
    enhancedUrlRef.current = nextUrl;
    setEnhancedUrl(nextUrl);
  }, []);

  const getCurrentRuntimePlan = useCallback(() => {
    const capabilities = detectRuntimeCapabilities();
    const plan = createRuntimePlan(capabilities);
    setRuntimeCapabilities(capabilities);
    setRuntimePlan(plan);
    setActiveBackend(plan.backend);
    setEstimatedTime(plan.expectedTime);
    return plan;
  }, []);

  const handleWorkerMessage = useCallback(
    (response: WorkerResponse) => {
      if (response.requestId !== activeRequestIdRef.current) {
        return;
      }

      if (response.type === "ready") {
        setMode(response.mode);
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
        stopWorker();
        return;
      }

      if (response.type === "done") {
        const outputUrl = URL.createObjectURL(response.blob);
        revokeObjectUrl(enhancedUrlRef.current);
        updateEnhancedUrl(outputUrl);
        setMode(response.mode);
        setActiveBackend(response.backend);
        setWorkerWarning(response.warning);
        setProgress(100);
        setStage("Enhancement complete");
        setState("done");
        stopWorker();
      }
    },
    [revokeObjectUrl, stopWorker, updateEnhancedUrl],
  );

  useEffect(() => {
    getCurrentRuntimePlan();
  }, [getCurrentRuntimePlan]);

  useEffect(() => {
    setMode(resolveModeForPreset(preset, runtimePlan));
  }, [preset, runtimePlan]);

  useEffect(() => {
    return () => {
      stopWorker();
      revokeObjectUrl(previewUrlRef.current);
      revokeObjectUrl(enhancedUrlRef.current);
    };
  }, [revokeObjectUrl, stopWorker]);

  const handleFileSelected = useCallback(
    (selection: UploadSelection) => {
      revokeObjectUrl(previewUrlRef.current);
      revokeObjectUrl(enhancedUrlRef.current);
      updatePreviewUrl(selection.previewUrl);
      updateEnhancedUrl(null);
      setSelectedFile(selection.file);
      setFileName(selection.file.name);
      setSizeWarning(selection.warning);
      setWorkerWarning(null);
      setProgress(0);
      setStage("Ready to enhance");

      const plan = getCurrentRuntimePlan();
      setMode(resolveModeForPreset(preset, plan));
      setEstimatedTime(plan.expectedTime);
      setActiveBackend(plan.backend);
      setState("ready");
    },
    [
      getCurrentRuntimePlan,
      preset,
      revokeObjectUrl,
      updateEnhancedUrl,
      updatePreviewUrl,
    ],
  );

  const handleEnhance = useCallback(() => {
    if (!selectedFile) {
      return;
    }

    const plan = runtimePlan ?? getCurrentRuntimePlan();
    const resolvedMode = resolveModeForPreset(preset, plan);
    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    stopWorker();

    const worker = new Worker(
      new URL("../workers/enhance.worker.ts", import.meta.url),
    );
    workerRef.current = worker;
    activeRequestIdRef.current = requestId;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      handleWorkerMessage(event.data);
    };

    worker.onerror = () => {
      setWorkerWarning("Worker failed unexpectedly. Please try again.");
      setState("ready");
      setProgress(0);
      stopWorker();
    };

    setProgress(0);
    setStage("Starting worker...");
    setWorkerWarning(null);
    setEstimatedTime(plan.expectedTime);
    setActiveBackend(plan.backend);
    setMode(resolvedMode);
    setState("processing");

    worker.postMessage({
      type: "start",
      requestId,
      payload: {
        file: selectedFile,
        mode: resolvedMode,
        backend: plan.backend,
        timeoutMs: WORKER_TIMEOUT_MS,
        allowLowQualityFallback: preset !== "quality",
      },
    });
  }, [
    getCurrentRuntimePlan,
    handleWorkerMessage,
    preset,
    runtimePlan,
    selectedFile,
    stopWorker,
  ]);

  const handleCancel = useCallback(() => {
    stopWorker();
    setProgress(0);
    setStage("Cancelled");
    setWorkerWarning("Enhancement cancelled.");
    setState("ready");
  }, [stopWorker]);

  const handleReset = useCallback(() => {
    stopWorker();
    revokeObjectUrl(previewUrlRef.current);
    revokeObjectUrl(enhancedUrlRef.current);
    updatePreviewUrl(null);
    updateEnhancedUrl(null);
    setSelectedFile(null);
    setFileName("");
    setProgress(0);
    setStage("Preparing enhancement...");
    setSizeWarning(null);
    setWorkerWarning(null);
    setPreset(DEFAULT_PRESET);
    setMode(resolveModeForPreset(DEFAULT_PRESET, runtimePlan));
    setActiveBackend(runtimePlan?.backend ?? null);
    setEstimatedTime(runtimePlan?.expectedTime ?? null);
    setState("idle");
  }, [
    revokeObjectUrl,
    runtimePlan,
    stopWorker,
    updateEnhancedUrl,
    updatePreviewUrl,
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Subtle ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent"
      />
      <Header onReset={handleReset}/>
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-10 md:py-14 lg:py-20">
        <div className="w-full max-w-7xl transition-all duration-500">
          {state === "idle" && (
            <UploadZone onFileSelected={handleFileSelected} />
          )}

          {state === "ready" && previewUrl && (
            <EnhancementOptions
              previewUrl={previewUrl}
              fileName={fileName}
              mode={mode}
              preset={preset}
              runtimePlan={runtimePlan}
              capabilities={runtimeCapabilities}
              sizeWarning={sizeWarning}
              workerWarning={workerWarning}
              onPresetChange={setPreset}
              onEnhance={handleEnhance}
              onFileSelected={handleFileSelected}
            />
          )}

          {state === "processing" && (
            <ProcessingState
              progress={progress}
              stage={stage}
              backend={activeBackend}
              estimatedTime={estimatedTime}
              onCancel={handleCancel}
            />
          )}

          {state === "done" && previewUrl && enhancedUrl && (
            <PreviewSection
              originalUrl={previewUrl}
              enhancedUrl={enhancedUrl}
              mode={mode}
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
