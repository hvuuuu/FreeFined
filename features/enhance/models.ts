// Shared by the enhance worker and the main thread, so it must stay DOM-free.

import type { InferenceBackend } from "@/shared/inference/backend";
import { modelUrl } from "@/shared/models/registry";

export type EnhancementMode =
  "real-esrgan-x4" | "realesrgan-general-x4v3" | "super-resolution-lite";

export type EnhancementPreset = "auto" | "quality" | "balanced" | "fast";

export interface EnhancementModelSpec {
  label: string;
  description: string;
  scale: number;
  url: string;
  /** Canvas filter used by the non-ONNX fallback path when the model cannot load. */
  fallbackFilter: string;
  fallbackTileSize: number;
}

export interface EnhancementPresetSpec {
  label: string;
  description: string;
  /** `null` means "use the device's automatic recommendation". */
  mode: EnhancementMode | null;
}

export const ENHANCEMENT_MODELS: Record<EnhancementMode, EnhancementModelSpec> =
  {
    "real-esrgan-x4": {
      label: "Real-ESRGAN x4plus",
      description: "Highest-quality general photo upscaling",
      scale: 4,
      url: modelUrl("real-esrgan-x4"),
      fallbackFilter: "contrast(1.08) saturate(1.1) brightness(1.02)",
      fallbackTileSize: 64,
    },
    "realesrgan-general-x4v3": {
      label: "Real-ESRGAN General x4v3",
      description: "Best speed/quality default for most devices",
      scale: 4,
      url: modelUrl("realesrgan-general-x4v3"),
      fallbackFilter: "contrast(1.06) saturate(1.08) brightness(1.01)",
      fallbackTileSize: 128,
    },
    "super-resolution-lite": {
      label: "Super-Resolution Lite",
      description: "Small Y-channel fallback for compatibility",
      scale: 3,
      url: modelUrl("super-resolution-lite"),
      fallbackFilter: "contrast(1.05) saturate(1.05)",
      fallbackTileSize: 224,
    },
  };

export const ENHANCEMENT_PRESET_ORDER: readonly EnhancementPreset[] = [
  "auto",
  "quality",
  "balanced",
  "fast",
];

export const ENHANCEMENT_PRESETS: Record<
  EnhancementPreset,
  EnhancementPresetSpec
> = {
  auto: {
    label: "Auto",
    description: "Best quality-to-speed match for this device",
    mode: null,
  },
  quality: {
    label: "Quality",
    description: "Highest detail for strong desktop hardware",
    mode: "real-esrgan-x4",
  },
  balanced: {
    label: "Balanced",
    description: "Tiny Real-ESRGAN with strong p/p",
    mode: "realesrgan-general-x4v3",
  },
  fast: {
    label: "Fast",
    description: "Compatibility fallback for weak devices",
    mode: "super-resolution-lite",
  },
};

export function resolvePresetMode(
  preset: EnhancementPreset,
  autoMode: EnhancementMode,
): EnhancementMode {
  return ENHANCEMENT_PRESETS[preset].mode ?? autoMode;
}

export interface EnhanceInput {
  file: File;
  mode: EnhancementMode;
  backend: InferenceBackend;
  /** On WASM, the worker switches to the Fast model after this long (see allowLowQualityFallback). */
  softTimeoutMs: number;
  allowLowQualityFallback: boolean;
}

export interface EnhanceResult {
  blob: Blob;
  /** The model that produced the result; differs from the input after a fallback. */
  mode: EnhancementMode;
  backend: InferenceBackend;
  warning: string | null;
}
