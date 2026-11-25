import type { InferenceBackend } from "@/shared/inference/backend";
import {
  isConstrainedDevice,
  isVeryWeakDevice,
  type RuntimeCapabilities,
  type RuntimeTier,
} from "@/shared/runtime/capabilities";
import type { EnhancementMode } from "./models";

export interface EnhancementPlan {
  tier: RuntimeTier;
  conditionLabel: string;
  conditionHint: string;
  backend: InferenceBackend;
  mode: EnhancementMode;
  expectedTime: string;
  qualityStars: number;
}

export function createEnhancementPlan(
  capabilities: RuntimeCapabilities,
): EnhancementPlan {
  if (capabilities.hasWebGPU) {
    if (isConstrainedDevice(capabilities)) {
      return {
        tier: "webgpu-available",
        conditionLabel: "WebGPU available",
        conditionHint: "Constrained device, using efficient x4 model",
        mode: "realesrgan-general-x4v3",
        backend: "webgpu",
        expectedTime: "3-10 sec",
        qualityStars: 4,
      };
    }

    return {
      tier: "webgpu-available",
      conditionLabel: "WebGPU available",
      conditionHint: "Strong GPU, quality model selected",
      mode: "real-esrgan-x4",
      backend: "webgpu",
      expectedTime: "4-12 sec",
      qualityStars: 5,
    };
  }

  if (capabilities.hasWebGL) {
    return {
      tier: "webgl-only",
      conditionLabel: "WebGL only (no WebGPU)",
      conditionHint: "Older browser, using efficient x4 model",
      mode: "realesrgan-general-x4v3",
      backend: "webgl",
      expectedTime: "10-25 sec",
      qualityStars: 4,
    };
  }

  if (!capabilities.isMobile && !isVeryWeakDevice(capabilities)) {
    return {
      tier: "cpu-mobile",
      conditionLabel: "CPU only",
      conditionHint: "WASM fallback, efficient model selected",
      mode: "realesrgan-general-x4v3",
      backend: "wasm",
      expectedTime: "30-90 sec",
      qualityStars: 3,
    };
  }

  return {
    tier: "very-weak-timeout",
    conditionLabel: "Very weak / may time out",
    conditionHint: "WASM only, compatibility fallback selected",
    mode: "super-resolution-lite",
    backend: "wasm",
    expectedTime: "20-60 sec",
    qualityStars: 1,
  };
}
