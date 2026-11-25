// Main-thread device detection. Tools turn these facts into a plan in their own runtime-plan.ts.

export type RuntimeTier =
  "webgpu-available" | "webgl-only" | "cpu-mobile" | "very-weak-timeout";

export interface RuntimeCapabilities {
  hasWebGPU: boolean;
  hasWebGL: boolean;
  isMobile: boolean;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  saveData: boolean;
  effectiveConnectionType: string | null;
}

export interface GpuLimitsProbe {
  maxStorageBuffersPerShaderStage: number;
}

/** Non-standard Navigator fields some browsers expose. */
interface ExtendedNavigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

function detectWebGLSupport(): boolean {
  const canvas = document.createElement("canvas");
  const context =
    canvas.getContext("webgl2") ??
    canvas.getContext("webgl") ??
    canvas.getContext("experimental-webgl");
  return Boolean(context);
}

export function detectRuntimeCapabilities(): RuntimeCapabilities {
  const extended = navigator as Navigator & ExtendedNavigator;
  const connection = extended.connection;

  return {
    hasWebGPU: "gpu" in navigator,
    hasWebGL: detectWebGLSupport(),
    isMobile: /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent),
    deviceMemory:
      typeof extended.deviceMemory === "number" ? extended.deviceMemory : null,
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

export function isVeryWeakDevice(capabilities: RuntimeCapabilities): boolean {
  const lowMemory =
    capabilities.deviceMemory !== null && capabilities.deviceMemory <= 2;
  const lowCpuThreads =
    capabilities.hardwareConcurrency !== null &&
    capabilities.hardwareConcurrency <= 4;
  return lowMemory || lowCpuThreads;
}

export function isConstrainedDevice(
  capabilities: RuntimeCapabilities,
): boolean {
  const constrainedMemory =
    capabilities.deviceMemory !== null && capabilities.deviceMemory <= 4;
  const constrainedCpu =
    capabilities.hardwareConcurrency !== null &&
    capabilities.hardwareConcurrency <= 6;
  return capabilities.isMobile || constrainedMemory || constrainedCpu;
}

export function isSlowNetwork(capabilities: RuntimeCapabilities): boolean {
  return (
    capabilities.saveData ||
    capabilities.effectiveConnectionType === "slow-2g" ||
    capabilities.effectiveConnectionType === "2g"
  );
}

let gpuLimitsPromise: Promise<GpuLimitsProbe | null> | null = null;

/** Adapter limits don't change during a session, so the probe runs once and is shared. */
export function probeWebGpuLimits(): Promise<GpuLimitsProbe | null> {
  gpuLimitsPromise ??= (async () => {
    // lib.dom types navigator.gpu as always present; browsers without WebGPU omit it.
    if (!("gpu" in navigator)) {
      return null;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter) {
        return null;
      }
      return {
        maxStorageBuffersPerShaderStage:
          adapter.limits.maxStorageBuffersPerShaderStage,
      };
    } catch {
      return null;
    }
  })();
  return gpuLimitsPromise;
}
