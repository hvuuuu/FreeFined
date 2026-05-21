export type EnhancementMode =
  | "real-esrgan-x4"
  | "realesrgan-general-x4v3"
  | "super-resolution-lite";

export type ToolMode = "enhance" | "remove-background";

export type EnhancementPreset =
  | "auto"
  | "quality"
  | "balanced"
  | "fast";

export type BackgroundRemovalMode = "birefnet-lite-fp16" | "u2netp";

export type BackgroundRemovalPreset = "auto" | "quality" | "fast";

export interface ModelSpec {
  id: EnhancementMode;
  label: string;
  description: string;
  scale: number;
  url: string;
  fallbackFilter: string;
  fallbackTileSize: number;
}

export interface PresetSpec {
  id: EnhancementPreset;
  label: string;
  description: string;
  mode: EnhancementMode | null;
  qualityStars: number;
}

export interface BackgroundRemovalModelSpec {
  id: BackgroundRemovalMode;
  label: string;
  description: string;
  url: string;
  inputWidth: number;
  inputHeight: number;
  mean: readonly [number, number, number];
  std: readonly [number, number, number];
  outputTransform: "sigmoid" | "minmax";
}

export interface BackgroundRemovalPresetSpec {
  id: BackgroundRemovalPreset;
  label: string;
  description: string;
  mode: BackgroundRemovalMode | null;
  qualityStars: number;
}

export const MODEL_ORDER: EnhancementMode[] = [
  "real-esrgan-x4",
  "realesrgan-general-x4v3",
  "super-resolution-lite",
];

export const BACKGROUND_REMOVAL_MODEL_ORDER: BackgroundRemovalMode[] = [
  "birefnet-lite-fp16",
  "u2netp",
];

export const PRESET_ORDER: EnhancementPreset[] = [
  "auto",
  "quality",
  "balanced",
  "fast",
];

export const BACKGROUND_REMOVAL_PRESET_ORDER: BackgroundRemovalPreset[] = [
  "auto",
  "quality",
  "fast",
];

export const PRESET_SPECS: Record<EnhancementPreset, PresetSpec> = {
  auto: {
    id: "auto",
    label: "Auto",
    description: "Best quality-to-speed match for this device",
    mode: null,
    qualityStars: 5,
  },
  quality: {
    id: "quality",
    label: "Quality",
    description: "Highest detail for strong desktop hardware",
    mode: "real-esrgan-x4",
    qualityStars: 5,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "Tiny Real-ESRGAN with strong p/p",
    mode: "realesrgan-general-x4v3",
    qualityStars: 4,
  },
  fast: {
    id: "fast",
    label: "Fast",
    description: "Compatibility fallback for weak devices",
    mode: "super-resolution-lite",
    qualityStars: 1,
  },
};

export const BACKGROUND_REMOVAL_PRESET_SPECS: Record<
  BackgroundRemovalPreset,
  BackgroundRemovalPresetSpec
> = {
  auto: {
    id: "auto",
    label: "Auto",
    description: "Best matte-to-speed match for this device",
    mode: null,
    qualityStars: 5,
  },
  quality: {
    id: "quality",
    label: "Quality",
    description: "BiRefNet-lite for crisp foreground edges",
    mode: "birefnet-lite-fp16",
    qualityStars: 5,
  },
  fast: {
    id: "fast",
    label: "Fast",
    description: "Small U2Netp fallback for weak devices",
    mode: "u2netp",
    qualityStars: 3,
  },
};

export function resolvePresetMode(
  preset: EnhancementPreset,
  autoMode: EnhancementMode,
): EnhancementMode {
  return PRESET_SPECS[preset].mode ?? autoMode;
}

export function resolveBackgroundRemovalPresetMode(
  preset: BackgroundRemovalPreset,
  autoMode: BackgroundRemovalMode,
): BackgroundRemovalMode {
  return BACKGROUND_REMOVAL_PRESET_SPECS[preset].mode ?? autoMode;
}

export const MODEL_SPECS: Record<EnhancementMode, ModelSpec> = {
  "real-esrgan-x4": {
    id: "real-esrgan-x4",
    label: "Real-ESRGAN x4plus",
    description: "Highest-quality general photo upscaling",
    scale: 4,
    url: "/api/models/real-esrgan-x4",
    fallbackFilter: "contrast(1.08) saturate(1.1) brightness(1.02)",
    fallbackTileSize: 64,
  },
  "realesrgan-general-x4v3": {
    id: "realesrgan-general-x4v3",
    label: "Real-ESRGAN General x4v3",
    description: "Best speed/quality default for most devices",
    scale: 4,
    url: "/api/models/realesrgan-general-x4v3",
    fallbackFilter: "contrast(1.06) saturate(1.08) brightness(1.01)",
    fallbackTileSize: 128,
  },
  "super-resolution-lite": {
    id: "super-resolution-lite",
    label: "Super-Resolution Lite",
    description: "Small Y-channel fallback for compatibility",
    scale: 3,
    url: "/api/models/super-resolution-lite",
    fallbackFilter: "contrast(1.05) saturate(1.05)",
    fallbackTileSize: 224,
  },
};

export const BACKGROUND_REMOVAL_MODEL_SPECS: Record<
  BackgroundRemovalMode,
  BackgroundRemovalModelSpec
> = {
  "birefnet-lite-fp16": {
    id: "birefnet-lite-fp16",
    label: "BiRefNet Lite FP16",
    description: "High-quality alpha matte for capable WebGPU devices",
    url: "/api/models/birefnet-lite-fp16",
    inputWidth: 1024,
    inputHeight: 1024,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    outputTransform: "sigmoid",
  },
  u2netp: {
    id: "u2netp",
    label: "U2Netp",
    description: "Tiny automatic subject mask for broad compatibility",
    url: "/api/models/u2netp",
    inputWidth: 320,
    inputHeight: 320,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    outputTransform: "minmax",
  },
};
