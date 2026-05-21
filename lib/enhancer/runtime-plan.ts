import { SOFT_MAX_DIMENSION } from "@/lib/enhancer/image-size";
import type {
  BackgroundRemovalMode,
  EnhancementMode,
} from "@/lib/enhancer/models";

export type InferenceBackend = "webgpu" | "webgl" | "wasm";
export type RuntimeTier =
  | "webgpu-available"
  | "webgl-only"
  | "cpu-mobile"
  | "very-weak-timeout";

export interface RuntimeCapabilities {
  hasWebGPU: boolean;
  hasWebGL: boolean;
  isMobile: boolean;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  saveData: boolean;
  effectiveConnectionType: string | null;
}

export interface RuntimePlan {
  tier: RuntimeTier;
  conditionLabel: string;
  conditionHint: string;
  backend: InferenceBackend;
  mode: EnhancementMode;
  expectedTime: string;
  qualityStars: number;
}

export interface BackgroundRemovalRuntimePlan {
  tier: RuntimeTier;
  conditionLabel: string;
  conditionHint: string;
  backend: InferenceBackend;
  mode: BackgroundRemovalMode;
  expectedTime: string;
  qualityStars: number;
}

export interface RuntimeImageSize {
  width: number;
  height: number;
}

export interface GpuLimitsProbe {
  maxStorageBuffersPerShaderStage: number;
}

/**
 * BiRefNet-lite FP16 compute shaders bind up to 65 storage buffers in a
 * single stage. On Windows/D3D12, integrated GPUs (Intel HD/UHD/Xe) report
 * ≤ 64 while discrete GPUs (NVIDIA/AMD) report 1 000 000+. A threshold of
 * 128 cleanly separates these two hardware tiers — any adapter below 128
 * cannot run BiRefNet's heaviest shaders and would crash at dispatch time.
 */
const BIREFNET_MIN_STORAGE_BUFFERS = 128;

interface NavigatorConnection {
  saveData?: boolean;
  effectiveType?: string;
}

function detectWebGLSupport(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const canvas = document.createElement("canvas");
  const context =
    canvas.getContext("webgl2") ??
    canvas.getContext("webgl") ??
    canvas.getContext("experimental-webgl");
  return Boolean(context);
}

export function detectRuntimeCapabilities(): RuntimeCapabilities {
  if (typeof navigator === "undefined") {
    return {
      hasWebGPU: false,
      hasWebGL: false,
      isMobile: false,
      deviceMemory: null,
      hardwareConcurrency: null,
      saveData: false,
      effectiveConnectionType: null,
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
  const hasWebGPU = "gpu" in navigator;
  const hasWebGL = detectWebGLSupport();
  const connection =
    "connection" in navigator
      ? ((navigator as Navigator & { connection?: NavigatorConnection })
          .connection ?? null)
      : null;

  return {
    hasWebGPU,
    hasWebGL,
    isMobile,
    deviceMemory:
      typeof (navigator as Navigator & { deviceMemory?: number })
        .deviceMemory === "number"
        ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ??
          null)
        : null,
    hardwareConcurrency:
      typeof navigator.hardwareConcurrency === "number"
        ? navigator.hardwareConcurrency
        : null,
    saveData: connection?.saveData === true,
    effectiveConnectionType:
      typeof connection?.effectiveType === "string"
        ? connection.effectiveType
        : null,
  };
}

function isVeryWeakDevice(capabilities: RuntimeCapabilities) {
  const lowMemory =
    capabilities.deviceMemory !== null && capabilities.deviceMemory <= 2;
  const lowCpuThreads =
    capabilities.hardwareConcurrency !== null &&
    capabilities.hardwareConcurrency <= 4;
  return lowMemory || lowCpuThreads;
}

function isConstrainedDevice(capabilities: RuntimeCapabilities) {
  const constrainedMemory =
    capabilities.deviceMemory !== null && capabilities.deviceMemory <= 4;
  const constrainedCpu =
    capabilities.hardwareConcurrency !== null &&
    capabilities.hardwareConcurrency <= 6;
  return capabilities.isMobile || constrainedMemory || constrainedCpu;
}

export function createRuntimePlan(
  capabilities: RuntimeCapabilities,
): RuntimePlan {
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

function isSlowNetwork(capabilities: RuntimeCapabilities) {
  return (
    capabilities.saveData ||
    capabilities.effectiveConnectionType === "slow-2g" ||
    capabilities.effectiveConnectionType === "2g"
  );
}

function isLargeImageForBackgroundRemoval(imageSize?: RuntimeImageSize | null) {
  if (!imageSize) {
    return false;
  }

  return Math.max(imageSize.width, imageSize.height) > SOFT_MAX_DIMENSION;
}

export function createBackgroundRemovalRuntimePlan(
  capabilities: RuntimeCapabilities,
  imageSize?: RuntimeImageSize | null,
  gpuLimits?: GpuLimitsProbe | null,
): BackgroundRemovalRuntimePlan {
  const shouldPreferSmallModel =
    isConstrainedDevice(capabilities) ||
    isSlowNetwork(capabilities) ||
    isLargeImageForBackgroundRemoval(imageSize);

  const gpuMeetsBufferRequirement =
    gpuLimits !== undefined &&
    gpuLimits !== null &&
    gpuLimits.maxStorageBuffersPerShaderStage >= BIREFNET_MIN_STORAGE_BUFFERS;

  // Only recommend BiRefNet when the GPU adapter actually supports enough
  // storage buffers. When gpuLimits is null (probe hasn't run yet or
  // failed), we conservatively skip BiRefNet to avoid the expensive
  // download-then-fail cycle.
  if (
    capabilities.hasWebGPU &&
    !shouldPreferSmallModel &&
    gpuMeetsBufferRequirement
  ) {
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

/**
 * Asynchronously probe the WebGPU adapter for hardware limits that determine
 * whether BiRefNet-lite can actually run. Call once at app startup and cache
 * the result — the adapter limits won't change during a session.
 */
export async function probeWebGpuLimits(): Promise<GpuLimitsProbe | null> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return null;
  }

  try {
    const gpu = (
      navigator as Navigator & {
        gpu: {
          requestAdapter(options?: {
            powerPreference?: "low-power" | "high-performance";
          }): Promise<{ limits: Record<string, number> } | null>;
        };
      }
    ).gpu;
    const adapter = await gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) {
      return null;
    }

    return {
      maxStorageBuffersPerShaderStage:
        adapter.limits.maxStorageBuffersPerShaderStage ?? 8,
    };
  } catch {
    return null;
  }
}
