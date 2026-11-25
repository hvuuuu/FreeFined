import { SOFT_MAX_DIMENSION } from "@/shared/image/image-size";
import type { InferenceBackend } from "@/shared/inference/backend";
import {
  isConstrainedDevice,
  isSlowNetwork,
  isVeryWeakDevice,
  type GpuLimitsProbe,
  type RuntimeCapabilities,
  type RuntimeTier,
} from "@/shared/runtime/capabilities";
import {
  BACKGROUND_REMOVAL_MODELS,
  BACKGROUND_REMOVAL_PRESETS,
  type BackgroundRemovalMode,
  type BackgroundRemovalPreset,
} from "./models";

export interface BackgroundRemovalPlan {
  tier: RuntimeTier;
  conditionLabel: string;
  conditionHint: string;
  backend: InferenceBackend;
  mode: BackgroundRemovalMode;
  expectedTime: string;
  qualityStars: number;
}

/**
 * BiRefNet-lite FP16 compute shaders bind up to 65 storage buffers in one stage.
 * On Windows/D3D12, integrated GPUs report 64 or fewer while discrete GPUs report
 * 1 000 000+, so 128 separates hardware that can run it from hardware that crashes.
 */
const BIREFNET_MIN_STORAGE_BUFFERS = 128;

export function createBackgroundRemovalPlan(
  capabilities: RuntimeCapabilities,
  imageSize: { width: number; height: number },
  /** `null` or `undefined` (unknown, or still probing) conservatively rules out BiRefNet. */
  gpuLimits: GpuLimitsProbe | null | undefined,
): BackgroundRemovalPlan {
  const shouldPreferSmallModel =
    isConstrainedDevice(capabilities) ||
    isSlowNetwork(capabilities) ||
    Math.max(imageSize.width, imageSize.height) > SOFT_MAX_DIMENSION;
  const gpuCanRunBiRefNet =
    gpuLimits != null &&
    gpuLimits.maxStorageBuffersPerShaderStage >= BIREFNET_MIN_STORAGE_BUFFERS;

  if (capabilities.hasWebGPU && !shouldPreferSmallModel && gpuCanRunBiRefNet) {
    return {
      tier: "webgpu-available",
      conditionLabel: "WebGPU available",
      conditionHint: "Strong device, using BiRefNet-lite",
      mode: "birefnet-lite-fp16",
      backend: "webgpu",
      expectedTime: "5-20 sec",
      qualityStars: 5,
    };
  }

  if (capabilities.hasWebGPU) {
    return {
      tier: "webgpu-available",
      conditionLabel: "WebGPU available",
      conditionHint: "Constrained device, using lightweight U2Netp",
      mode: "u2netp",
      backend: "webgpu",
      expectedTime: "2-8 sec",
      qualityStars: 3,
    };
  }

  if (!capabilities.isMobile && !isVeryWeakDevice(capabilities)) {
    return {
      tier: "cpu-mobile",
      conditionLabel: "CPU only",
      conditionHint: "WASM fallback, using lightweight U2Netp",
      mode: "u2netp",
      backend: "wasm",
      expectedTime: "5-20 sec",
      qualityStars: 3,
    };
  }

  return {
    tier: "very-weak-timeout",
    conditionLabel: "Very weak / may time out",
    conditionHint: "WASM only, using the smallest matte model",
    mode: "u2netp",
    backend: "wasm",
    expectedTime: "10-30 sec",
    qualityStars: 2,
  };
}

/** The model to run for a preset; never a WebGPU-only model on a device without WebGPU. */
export function resolveBackgroundRemovalMode(
  preset: BackgroundRemovalPreset,
  plan: BackgroundRemovalPlan,
  hasWebGPU: boolean,
): BackgroundRemovalMode {
  const mode = BACKGROUND_REMOVAL_PRESETS[preset].mode ?? plan.mode;
  return BACKGROUND_REMOVAL_MODELS[mode].requiresWebGpu && !hasWebGPU
    ? "u2netp"
    : mode;
}
