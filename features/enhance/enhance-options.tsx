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
import { Cpu, MonitorPlay, Wand2, Zap } from "lucide-react";
import {
  ENHANCEMENT_MODELS,
  ENHANCEMENT_PRESET_ORDER,
  ENHANCEMENT_PRESETS,
  type EnhancementMode,
  type EnhancementPreset,
} from "./models";
import type { EnhancementPlan } from "./runtime-plan";

interface EnhanceOptionsProps {
  plan: EnhancementPlan;
  capabilities: RuntimeCapabilities;
  preset: EnhancementPreset;
  mode: EnhancementMode;
  warning: string | null;
  onPresetChange: (preset: EnhancementPreset) => void;
  onEnhance: () => void;
}

export function EnhanceOptions({
  plan,
  capabilities,
  preset,
  mode,
  warning,
  onPresetChange,
  onEnhance,
}: EnhanceOptionsProps) {
  const presets: PresetOption<EnhancementPreset>[] =
    ENHANCEMENT_PRESET_ORDER.map((id) => {
      const spec = ENHANCEMENT_PRESETS[id];
      return {
        id,
        label: spec.label,
        description: spec.description,
        modelLabel: ENHANCEMENT_MODELS[spec.mode ?? plan.mode].label,
        icon: Wand2,
        recommended: id === "auto",
        unavailableReason: null,
      };
    });

  const engines: EngineOption[] = [
    {
      backend: "webgpu",
      icon: Zap,
      expectedTime: "3-12 sec",
      supported: capabilities.hasWebGPU,
    },
    {
      backend: "webgl",
      icon: MonitorPlay,
      expectedTime: "10-25 sec",
      supported: capabilities.hasWebGL,
    },
    { backend: "wasm", icon: Cpu, expectedTime: "20-90 sec", supported: true },
  ];

  return (
    <InferenceOptionsCard
      icon={Wand2}
      title="Enhancement Options"
      description="Auto mode picks the best quality your device can handle. You can override it below."
      warning={warning}
      action={{ label: "Enhance Image", onClick: onEnhance }}
    >
      <RuntimeSummary
        conditionLabel={plan.conditionLabel}
        conditionHint={plan.conditionHint}
        qualityStars={plan.qualityStars}
        recommendation={`${ENHANCEMENT_MODELS[plan.mode].label} on ${BACKEND_LABELS[plan.backend]} (${plan.expectedTime})`}
        selected={preset === "auto" ? null : ENHANCEMENT_MODELS[mode].label}
      />
      <PresetGrid
        title="Enhancement Modes"
        options={presets}
        selected={preset}
        onSelect={onPresetChange}
      />
      <Separator />
      <EngineGrid options={engines} active={plan.backend} />
    </InferenceOptionsCard>
  );
}
