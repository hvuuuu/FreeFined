"use client";

import { CompareSlider } from "@/components/compare-slider";
import { OptionsLayout } from "@/components/options-layout";
import { ProcessingState } from "@/components/processing-state";
import { ResultFrame } from "@/components/result-frame";
import { outputFileName } from "@/shared/image/file-name";
import { BACKEND_LABELS } from "@/shared/inference/backend";
import { useRuntimeCapabilities } from "@/shared/runtime/use-runtime-capabilities";
import type { ToolPanelProps } from "@/shared/tools/tool-definition";
import type { SourceImage } from "@/shared/upload/process-upload";
import { Wand2 } from "lucide-react";
import { useState } from "react";
import { EnhanceOptions } from "./enhance-options";
import {
  ENHANCEMENT_MODELS,
  resolvePresetMode,
  type EnhancementPreset,
} from "./models";
import { createEnhancementPlan } from "./runtime-plan";
import { ENHANCE_SOFT_TIMEOUT_MS, useEnhance } from "./use-enhance";

export function EnhancePanel({
  source,
  onSourceChange,
  onReset,
  renderToolSelector,
}: ToolPanelProps) {
  const job = useEnhance();
  const { capabilities } = useRuntimeCapabilities();
  const [preset, setPreset] = useState<EnhancementPreset>("auto");

  const plan = createEnhancementPlan(capabilities);
  const mode = resolvePresetMode(preset, plan.mode);

  function handleSourceChange(next: SourceImage) {
    job.reset();
    onSourceChange(next);
  }

  function renderBody() {
    const { state } = job;
    switch (state.status) {
      case "running":
        return (
          <ProcessingState
            title="Enhancing your image"
            description={`Running on ${BACKEND_LABELS[plan.backend]} (${plan.expectedTime}).`}
            icon={Wand2}
            progress={state.progress}
            stage={state.stage}
            onCancel={job.cancel}
          />
        );

      case "done":
        return (
          <ResultFrame
            title="Enhancement complete"
            warning={state.value.warning}
            footnote={`Model used: ${ENHANCEMENT_MODELS[state.value.mode].label}`}
            download={{
              url: state.value.url,
              fileName: outputFileName(source.file.name, {
                suffix: "-enhanced",
                extension: "png",
              }),
              label: "Download Enhanced",
            }}
            onReset={onReset}
          >
            <CompareSlider
              beforeUrl={source.previewUrl}
              afterUrl={state.value.url}
              beforeLabel="Before"
              afterLabel="After"
            />
          </ResultFrame>
        );

      case "idle":
      case "failed":
        return (
          <OptionsLayout source={source} onSourceChange={handleSourceChange}>
            <EnhanceOptions
              plan={plan}
              capabilities={capabilities}
              preset={preset}
              mode={mode}
              warning={
                state.status === "failed" ? state.error.message : source.warning
              }
              onPresetChange={setPreset}
              onEnhance={() =>
                job.start({
                  file: source.file,
                  mode,
                  backend: plan.backend,
                  softTimeoutMs: ENHANCE_SOFT_TIMEOUT_MS,
                  allowLowQualityFallback: preset !== "quality",
                })
              }
            />
          </OptionsLayout>
        );
    }
  }

  return (
    <>
      {renderToolSelector({ disabled: job.state.status === "running" })}
      {renderBody()}
    </>
  );
}
