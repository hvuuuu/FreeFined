// Shared by the remove-background worker and the main thread, so it must stay DOM-free.

import type { InferenceBackend } from "@/shared/inference/backend";
import { modelUrl } from "@/shared/models/registry";

export type BackgroundRemovalMode = "birefnet-lite-fp16" | "u2netp";

export type BackgroundRemovalPreset = "auto" | "quality" | "fast";

export interface BackgroundRemovalModelSpec {
  label: string;
  description: string;
  url: string;
  requiresWebGpu: boolean;
  inputWidth: number;
  inputHeight: number;
  mean: readonly [number, number, number];
  std: readonly [number, number, number];
  outputTransform: "sigmoid" | "minmax";
}

export interface BackgroundRemovalPresetSpec {
  label: string;
  description: string;
  /** `null` means "use the automatic recommendation for this device". */
  mode: BackgroundRemovalMode | null;
}

export const BACKGROUND_REMOVAL_MODELS: Record<
  BackgroundRemovalMode,
  BackgroundRemovalModelSpec
> = {
  "birefnet-lite-fp16": {
    label: "BiRefNet Lite FP16",
    description: "High-quality alpha matte for capable WebGPU devices",
    url: modelUrl("birefnet-lite-fp16"),
    requiresWebGpu: true,
    inputWidth: 1024,
    inputHeight: 1024,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    outputTransform: "sigmoid",
  },
  u2netp: {
    label: "U2Netp",
    description: "Tiny automatic subject mask for broad compatibility",
    url: modelUrl("u2netp"),
    requiresWebGpu: false,
    inputWidth: 320,
    inputHeight: 320,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    outputTransform: "minmax",
  },
};

export const BACKGROUND_REMOVAL_PRESET_ORDER: readonly BackgroundRemovalPreset[] =
  ["auto", "quality", "fast"];

export const BACKGROUND_REMOVAL_PRESETS: Record<
  BackgroundRemovalPreset,
  BackgroundRemovalPresetSpec
> = {
  auto: {
    label: "Auto",
    description: "Best matte-to-speed match for this device",
    mode: null,
  },
  quality: {
    label: "Quality",
    description: "BiRefNet-lite for crisp foreground edges",
    mode: "birefnet-lite-fp16",
  },
  fast: {
    label: "Fast",
    description: "Small U2Netp fallback for weak devices",
    mode: "u2netp",
  },
};

export interface RemoveBackgroundInput {
  file: File;
  mode: BackgroundRemovalMode;
  backend: InferenceBackend;
  softTimeoutMs: number;
  allowFallback: boolean;
}

export interface RemoveBackgroundResult {
  blob: Blob;
  /** The model that produced the result; differs from the input after a fallback. */
  mode: BackgroundRemovalMode;
  backend: InferenceBackend;
  warning: string | null;
}
