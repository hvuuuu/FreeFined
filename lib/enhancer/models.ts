export type EnhancementMode =
  | "real-esrgan-x4"
  | "realesrgan-general-x4v3"
  | "super-resolution-lite";

export type EnhancementPreset =
  | "auto"
  | "quality"
  | "balanced"
  | "fast";

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

export const MODEL_ORDER: EnhancementMode[] = [
  "real-esrgan-x4",
  "realesrgan-general-x4v3",
  "super-resolution-lite",
];

export const PRESET_ORDER: EnhancementPreset[] = [
  "auto",
  "quality",
  "balanced",
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

export function resolvePresetMode(
  preset: EnhancementPreset,
  autoMode: EnhancementMode,
): EnhancementMode {
  return PRESET_SPECS[preset].mode ?? autoMode;
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
