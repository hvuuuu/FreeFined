"use client";

import { OptionsLayout } from "@/components/options-layout";
import { ProcessingState } from "@/components/processing-state";
import { ResultFrame } from "@/components/result-frame";
import { outputFileName } from "@/shared/image/file-name";
import { BACKEND_LABELS } from "@/shared/inference/backend";
import { useRuntimeCapabilities } from "@/shared/runtime/use-runtime-capabilities";
import type { ToolPanelProps } from "@/shared/tools/tool-definition";
import type { SourceImage } from "@/shared/upload/process-upload";
import { Scissors } from "lucide-react";
import { useState } from "react";
import {
  BACKGROUND_REMOVAL_MODELS,
  type BackgroundRemovalPreset,
} from "./models";
import { RemoveBackgroundOptions } from "./remove-background-options";
import {
  createBackgroundRemovalPlan,
  resolveBackgroundRemovalMode,
} from "./runtime-plan";
import { TransparentPreview } from "./transparent-preview";
import {
  REMOVE_BACKGROUND_SOFT_TIMEOUT_MS,
  useRemoveBackground,
} from "./use-remove-background";

export function RemoveBackgroundPanel({
  source,
  onSourceChange,
  onReset,
  renderToolSelector,
}: ToolPanelProps) {
  const job = useRemoveBackground();
  const { capabilities, gpuLimits } = useRuntimeCapabilities();
  const [preset, setPreset] = useState<BackgroundRemovalPreset>("auto");

  const plan = createBackgroundRemovalPlan(capabilities, source, gpuLimits);
  const mode = resolveBackgroundRemovalMode(
    preset,
    plan,
    capabilities.hasWebGPU,
  );

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
            title="Removing background"
            description={`Running on ${BACKEND_LABELS[plan.backend]} (${plan.expectedTime}).`}
            icon={Scissors}
            progress={state.progress}
            stage={state.stage}
            onCancel={job.cancel}
          />
        );

      case "done":
        return (
          <ResultFrame
            title="Background removed"
            warning={state.value.warning}
            footnote={`Model used: ${BACKGROUND_REMOVAL_MODELS[state.value.mode].label}`}
            download={{
              url: state.value.url,
              fileName: outputFileName(source.file.name, {
                suffix: "-no-bg",
                extension: "png",
              }),
              label: "Download Transparent",
            }}
            onReset={onReset}
          >
            <TransparentPreview url={state.value.url} />
          </ResultFrame>
        );

      case "idle":
      case "failed":
        return (
          <OptionsLayout source={source} onSourceChange={handleSourceChange}>
            <RemoveBackgroundOptions
              plan={plan}
              capabilities={capabilities}
              preset={preset}
              mode={mode}
              warning={
                state.status === "failed" ? state.error.message : source.warning
              }
              onPresetChange={setPreset}
              onRemoveBackground={() =>
                job.start({
                  file: source.file,
                  mode,
                  backend: plan.backend,
                  softTimeoutMs: REMOVE_BACKGROUND_SOFT_TIMEOUT_MS,
                  allowFallback: true,
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
