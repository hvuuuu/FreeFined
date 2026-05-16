import type { EnhancementMode } from "@/lib/enhancer/models";

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
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
  const hasWebGPU = "gpu" in navigator;
  const hasWebGL = detectWebGLSupport();

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
