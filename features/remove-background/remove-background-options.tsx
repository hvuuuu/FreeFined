"use client";

import {
  EngineGrid,
  InferenceOptionsCard,
  PresetGrid,
  RuntimeSummary,
  type EngineOption,
  type PresetOption,
} from "@/components/inference-options";
import { Separator } from "@/components/ui/separator";
import { BACKEND_LABELS } from "@/shared/inference/backend";
import type { RuntimeCapabilities } from "@/shared/runtime/capabilities";
import { Cpu, Scissors, Sparkles, Zap } from "lucide-react";
import {
  BACKGROUND_REMOVAL_MODELS,
  BACKGROUND_REMOVAL_PRESET_ORDER,
  BACKGROUND_REMOVAL_PRESETS,
  type BackgroundRemovalMode,
  type BackgroundRemovalPreset,
} from "./models";
import type { BackgroundRemovalPlan } from "./runtime-plan";

interface RemoveBackgroundOptionsProps {
  plan: BackgroundRemovalPlan;
  capabilities: RuntimeCapabilities;
  preset: BackgroundRemovalPreset;
  mode: BackgroundRemovalMode;
  warning: string | null;
  onPresetChange: (preset: BackgroundRemovalPreset) => void;
  onRemoveBackground: () => void;
}

export function RemoveBackgroundOptions({
  plan,
  capabilities,
  preset,
  mode,
  warning,
  onPresetChange,
  onRemoveBackground,
}: RemoveBackgroundOptionsProps) {
  const presets: PresetOption<BackgroundRemovalPreset>[] =
    BACKGROUND_REMOVAL_PRESET_ORDER.map((id) => {
      const spec = BACKGROUND_REMOVAL_PRESETS[id];
      const model = BACKGROUND_REMOVAL_MODELS[spec.mode ?? plan.mode];
      return {
        id,
        label: spec.label,
        description: spec.description,
        modelLabel: model.label,
        icon: id === "quality" ? Sparkles : Scissors,
        recommended: id === "auto",
        unavailableReason:
          model.requiresWebGpu && !capabilities.hasWebGPU
            ? "Requires WebGPU"
            : null,
      };
    });

  const engines: EngineOption[] = [
    {
      backend: "webgpu",
      icon: Zap,
      expectedTime: "2-20 sec",
      supported: capabilities.hasWebGPU,
    },
    { backend: "wasm", icon: Cpu, expectedTime: "5-30 sec", supported: true },
  ];

  return (
    <InferenceOptionsCard
      icon={Scissors}
      title="Background Removal"
      description="Auto mode uses BiRefNet-lite only when this device can comfortably run it."
      warning={warning}
      action={{ label: "Remove Background", onClick: onRemoveBackground }}
    >
      <RuntimeSummary
        conditionLabel={plan.conditionLabel}
        conditionHint={plan.conditionHint}
        qualityStars={plan.qualityStars}
        recommendation={`${BACKGROUND_REMOVAL_MODELS[plan.mode].label} on ${BACKEND_LABELS[plan.backend]} (${plan.expectedTime})`}
        selected={
          preset === "auto" ? null : BACKGROUND_REMOVAL_MODELS[mode].label
        }
      />
      <PresetGrid
        title="Matte Modes"
        options={presets}
        selected={preset}
        onSelect={onPresetChange}
      />
      <Separator />
      <EngineGrid options={engines} active={plan.backend} />
    </InferenceOptionsCard>
  );
}
