"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ACCEPT_ATTRIBUTE,
  processUploadFile,
  type UploadSelection,
} from "@/components/upload-zone";
import {
  BACKGROUND_REMOVAL_MODEL_SPECS,
  BACKGROUND_REMOVAL_PRESET_ORDER,
  BACKGROUND_REMOVAL_PRESET_SPECS,
  type BackgroundRemovalMode,
  type BackgroundRemovalPreset,
} from "@/lib/enhancer/models";
import type {
  BackgroundRemovalRuntimePlan,
  InferenceBackend,
  RuntimeCapabilities,
} from "@/lib/enhancer/runtime-plan";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Cpu,
  Scissors,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState, type ChangeEvent } from "react";

type ProcessorType = Extract<InferenceBackend, "webgpu" | "wasm">;

interface BackgroundRemovalOptionsProps {
  previewUrl: string;
  fileName: string;
  mode: BackgroundRemovalMode;
  preset: BackgroundRemovalPreset;
  runtimePlan: BackgroundRemovalRuntimePlan | null;
  capabilities: RuntimeCapabilities | null;
  sizeWarning: string | null;
  workerWarning: string | null;
  onPresetChange: (preset: BackgroundRemovalPreset) => void;
  onRemoveBackground: () => void;
  onFileSelected: (selection: UploadSelection) => void;
}

const PROCESSOR_ORDER: ProcessorType[] = ["webgpu", "wasm"];
const PROCESSOR_INFO: Record<
  ProcessorType,
  { label: string; time: string; Icon: LucideIcon }
> = {
  webgpu: { label: "WebGPU", time: "2-20 sec", Icon: Zap },
  wasm: { label: "WASM", time: "5-30 sec", Icon: Cpu },
};

function renderQualityStars(value: number) {
  return (
    <div
      className="flex items-center gap-0.5"
      title={`${value} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5 sm:h-4 sm:w-4",
            i < value
              ? "fill-amber-500 text-amber-500"
              : "fill-muted text-muted/30",
          )}
        />
      ))}
    </div>
  );
}

function getSupportedProcessors(
  capabilities: RuntimeCapabilities | null,
): Set<ProcessorType> {
  const supported = new Set<ProcessorType>(["wasm"]);
  if (capabilities?.hasWebGPU) {
    supported.add("webgpu");
  }
  return supported;
}

export function BackgroundRemovalOptions({
  previewUrl,
  fileName,
  mode,
  preset,
  runtimePlan,
  capabilities,
  sizeWarning,
  workerWarning,
  onPresetChange,
  onRemoveBackground,
  onFileSelected,
}: BackgroundRemovalOptionsProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const result = await processUploadFile(file);
        if (result.error) {
          setUploadError(result.error);
        } else if (result.selection) {
          setUploadError(null);
          onFileSelected(result.selection);
        }
      }
      if (event.target) {
        event.target.value = "";
      }
    },
    [onFileSelected],
  );

  const selectedProcessor = runtimePlan?.backend ?? "wasm";
  const supportedProcessors = getSupportedProcessors(capabilities);
  const autoMode = runtimePlan?.mode ?? "u2netp";

  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-8">
      <Card className="mx-auto w-full max-w-[20rem] overflow-hidden md:max-w-md lg:max-w-none">
        <div
          className="relative mx-auto aspect-4/5 w-full sm:aspect-4/3 lg:aspect-square"
        >
          <Image
            src={previewUrl || "/placeholder.svg"}
            alt="Selected image preview"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 70vw, 40vw"
            unoptimized
            className="h-full w-full object-contain p-1.5 sm:p-2"
          />
        </div>
        <CardContent className="flex flex-col gap-2 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p
              className="min-w-0 flex-1 truncate text-xs text-muted-foreground sm:text-sm"
              title={fileName}
            >
              {fileName}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={openFilePicker}
              className="shrink-0 cursor-pointer text-xs sm:text-sm"
            >
              Change
            </Button>
          </div>
          {uploadError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-400 sm:text-sm">
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{uploadError}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
      />

      <Card>
        <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-3 py-0!">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Scissors
              className="h-4 w-4 shrink-0 text-red-500"
              aria-hidden="true"
            />
            <span>Background Removal</span>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Auto mode uses BiRefNet-lite only when this device can comfortably
            run it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5 sm:space-y-3 px-4">
          {(sizeWarning || workerWarning) && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:text-sm">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{workerWarning ?? sizeWarning}</span>
              </p>
            </div>
          )}

          {runtimePlan && (
            <div className="rounded-md border border-border/50 bg-card/40 p-3 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{runtimePlan.conditionLabel}</p>
                  <p className="text-muted-foreground">
                    {runtimePlan.conditionHint}
                  </p>
                </div>
                {renderQualityStars(runtimePlan.qualityStars)}
              </div>
              <p className="mt-2 text-muted-foreground">
                Auto recommendation:{" "}
                {BACKGROUND_REMOVAL_MODEL_SPECS[runtimePlan.mode].label} on{" "}
                {PROCESSOR_INFO[runtimePlan.backend as ProcessorType]?.label ??
                  runtimePlan.backend.toUpperCase()}{" "}
                ({runtimePlan.expectedTime})
              </p>
              {preset !== "auto" && (
                <p className="mt-1 text-muted-foreground">
                  Selected: {BACKGROUND_REMOVAL_MODEL_SPECS[mode].label}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs font-medium sm:text-sm">Matte Modes</p>
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {BACKGROUND_REMOVAL_PRESET_ORDER.map((presetKey) => {
                  const info = BACKGROUND_REMOVAL_PRESET_SPECS[presetKey];
                  const previewMode = info.mode ?? autoMode;
                  const isSelected = preset === presetKey;
                  const isRecommended = presetKey === "auto";
                  const requiresWebGpu =
                    previewMode === "birefnet-lite-fp16" &&
                    !capabilities?.hasWebGPU;

                  return (
                    <Button
                      key={presetKey}
                      variant="outline"
                      disabled={requiresWebGpu}
                      onClick={() => onPresetChange(presetKey)}
                      className={cn(
                        "h-auto min-h-28 min-w-38 flex-col items-start justify-start gap-1 sm:gap-1.5 whitespace-normal rounded-lg border p-2 text-left sm:p-2.5 transition-all",
                        isSelected
                          ? "border-red-500 bg-red-500/10"
                          : "border-border/50 bg-card/50 hover:border-red-500/50 hover:bg-card/80",
                        requiresWebGpu && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {presetKey === "quality" ? (
                          <Sparkles className="h-4 w-4" />
                        ) : (
                          <Scissors className="h-4 w-4" />
                        )}
                        <p className="text-xs font-medium sm:text-sm">
                          {info.label}
                        </p>
                      </div>
                      <p className="text-[10px] text-muted-foreground sm:text-xs">
                        {info.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground sm:text-xs">
                        Model: {BACKGROUND_REMOVAL_MODEL_SPECS[previewMode].label}
                      </p>
                      {isRecommended && (
                        <Badge
                          variant="outline"
                          className="w-fit border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-300 sm:text-xs"
                        >
                          Recommended
                        </Badge>
                      )}
                      {requiresWebGpu && (
                        <Badge
                          variant="outline"
                          className="w-fit text-[10px] sm:text-xs"
                        >
                          Requires WebGPU
                        </Badge>
                      )}
                      {isSelected && (
                        <Badge
                          variant="default"
                          className="w-fit bg-red-500 text-[10px] hover:bg-red-600 sm:text-xs"
                        >
                          Selected
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium sm:text-sm">Processing Engine</p>
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {PROCESSOR_ORDER.map((processorKey) => {
                  const info = PROCESSOR_INFO[processorKey];
                  const isSupported = supportedProcessors.has(processorKey);
                  const isSelected = selectedProcessor === processorKey;

                  return (
                    <div
                      key={processorKey}
                      className={cn(
                        "flex min-w-32 flex-col gap-1 sm:gap-1.5 rounded-lg border p-2 text-left transition-all sm:p-2.5",
                        isSelected
                          ? "border-red-500 bg-red-500/10"
                          : isSupported
                            ? "border-border/50 bg-card/50 hover:border-red-500/50 hover:bg-card/80"
                            : "border-border/30 bg-muted/30 opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <info.Icon className="h-3.5 w-3.5" />
                        <p className="text-xs font-medium sm:text-sm">
                          {info.label}
                        </p>
                      </div>
                      <p className="text-[10px] text-muted-foreground sm:text-xs">
                        {info.time}
                      </p>
                      {isSelected && (
                        <Badge
                          variant="default"
                          className="w-fit bg-red-500 text-[10px] hover:bg-red-600 sm:text-xs"
                        >
                          Active
                        </Badge>
                      )}
                      {!isSupported && (
                        <Badge
                          variant="outline"
                          className="w-fit text-[10px] sm:text-xs"
                        >
                          Unavailable
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <Button
            onClick={onRemoveBackground}
            size="lg"
            className="w-full cursor-pointer bg-linear-to-r from-red-500 to-rose-500 text-sm text-white hover:from-red-600 hover:to-rose-600 sm:text-base"
          >
            <Scissors className="mr-2 h-4 w-4" aria-hidden="true" />
            Remove Background
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
