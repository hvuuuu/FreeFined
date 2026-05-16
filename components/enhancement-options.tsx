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
  MODEL_SPECS,
  PRESET_ORDER,
  PRESET_SPECS,
  type EnhancementMode,
  type EnhancementPreset,
} from "@/lib/enhancer/models";
import type {
  InferenceBackend,
  RuntimeCapabilities,
  RuntimePlan,
} from "@/lib/enhancer/runtime-plan";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Cpu,
  MonitorPlay,
  Star,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState, type ChangeEvent } from "react";

type ProcessorType = InferenceBackend;

interface EnhancementOptionsProps {
  previewUrl: string;
  fileName: string;
  mode: EnhancementMode;
  preset: EnhancementPreset;
  runtimePlan: RuntimePlan | null;
  capabilities: RuntimeCapabilities | null;
  sizeWarning: string | null;
  workerWarning: string | null;
  onPresetChange: (preset: EnhancementPreset) => void;
  onEnhance: () => void;
  onFileSelected: (selection: UploadSelection) => void;
}

const PROCESSOR_ORDER: ProcessorType[] = ["webgpu", "webgl", "wasm"];
const PROCESSOR_INFO: Record<
  ProcessorType,
  { label: string; time: string; Icon: LucideIcon }
> = {
  webgpu: { label: "WebGPU", time: "3-12 sec", Icon: Zap },
  webgl: { label: "WebGL", time: "10-25 sec", Icon: MonitorPlay },
  wasm: { label: "WASM", time: "20-90 sec", Icon: Cpu },
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
  if (!capabilities) {
    return new Set<ProcessorType>(["wasm"]);
  }

  const supported = new Set<ProcessorType>(["wasm"]);
  if (capabilities.hasWebGPU) {
    supported.add("webgpu");
  }
  if (capabilities.hasWebGL) {
    supported.add("webgl");
  }
  return supported;
}

export function EnhancementOptions({
  previewUrl,
  fileName,
  mode,
  preset,
  runtimePlan,
  capabilities,
  sizeWarning,
  workerWarning,
  onPresetChange,
  onEnhance,
  onFileSelected,
}: EnhancementOptionsProps) {
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
      // Reset input value so the same file can be selected again if needed
      if (event.target) {
        event.target.value = "";
      }
    },
    [onFileSelected],
  );

  const selectedProcessor = runtimePlan?.backend ?? "wasm";
  const supportedProcessors = getSupportedProcessors(capabilities);
  const autoMode = runtimePlan?.mode ?? "realesrgan-general-x4v3";

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[1fr_1.2fr]">
      <Card className="mx-auto w-full max-w-[20rem] overflow-hidden md:max-w-md lg:max-w-none">
        <div className="relative mx-auto aspect-[4/5] w-full bg-transparent sm:aspect-[4/3] lg:aspect-square">
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
              className="min-w-0 flex-1 truncate text-xs sm:text-sm text-muted-foreground"
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
        <CardHeader className="pb-3 md:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Wand2
              className="h-4 w-4 text-red-500 flex-shrink-0"
              aria-hidden="true"
            />
            <span>Enhancement Options</span>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Auto mode picks the best quality your device can handle. You can
            override it below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
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
                Auto recommendation: {MODEL_SPECS[runtimePlan.mode].label} on{" "}
                {PROCESSOR_INFO[runtimePlan.backend].label} (
                {runtimePlan.expectedTime})
              </p>
              {preset !== "auto" && (
                <p className="mt-1 text-muted-foreground">
                  Selected: {MODEL_SPECS[mode].label}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs sm:text-sm font-medium">Enhancement Modes</p>
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-3">
                {PRESET_ORDER.map((presetKey) => {
                  const info = PRESET_SPECS[presetKey];
                  const previewMode = info.mode ?? autoMode;
                  const isSelected = preset === presetKey;
                  const isRecommended = presetKey === "auto";

                  return (
                    <Button
                      key={presetKey}
                      variant="outline"
                      onClick={() => onPresetChange(presetKey)}
                      className={cn(
                        "h-auto min-h-[8rem] min-w-[9.5rem] flex-col items-start justify-start gap-2 whitespace-normal rounded-lg border p-2 text-left sm:p-3",
                        isSelected
                          ? "border-red-500 bg-red-500/10"
                          : "border-border/50 bg-card/50 hover:border-red-500/50 hover:bg-card/80",
                      )}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Wand2 className="h-4 w-4" />
                        <p className="text-xs sm:text-sm font-medium">
                          {info.label}
                        </p>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {info.description}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Model: {MODEL_SPECS[previewMode].label}
                      </p>
                      {isRecommended && (
                        <Badge
                          variant="outline"
                          className="w-fit border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-300 sm:text-xs"
                        >
                          Recommended
                        </Badge>
                      )}
                      {isSelected && (
                        <Badge
                          variant="default"
                          className="w-fit bg-red-500 hover:bg-red-600 text-[10px] sm:text-xs"
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
            <p className="text-xs sm:text-sm font-medium">Processing Engine</p>
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-3">
                {PROCESSOR_ORDER.map((processorKey) => {
                  const info = PROCESSOR_INFO[processorKey];
                  const isSupported = supportedProcessors.has(processorKey);
                  const isSelected = selectedProcessor === processorKey;

                  return (
                    <div
                      key={processorKey}
                      className={cn(
                        "flex min-w-[8.5rem] flex-col gap-2 rounded-lg border p-2 sm:p-3 transition-all text-left",
                        isSelected
                          ? "border-red-500 bg-red-500/10"
                          : isSupported
                            ? "border-border/50 bg-card/50 hover:border-red-500/50 hover:bg-card/80"
                            : "border-border/30 bg-muted/30 opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <info.Icon className="h-3.5 w-3.5" />
                        <p className="text-xs sm:text-sm font-medium">
                          {info.label}
                        </p>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {info.time}
                      </p>
                      {isSelected && (
                        <Badge
                          variant="default"
                          className="w-fit bg-red-500 hover:bg-red-600 text-[10px] sm:text-xs"
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
            onClick={onEnhance}
            size="lg"
            className="w-full cursor-pointer bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 text-sm sm:text-base"
          >
            <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Enhance Image
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
