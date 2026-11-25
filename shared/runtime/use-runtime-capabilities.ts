"use client";

import { useEffect, useState } from "react";
import {
  detectRuntimeCapabilities,
  probeWebGpuLimits,
  type GpuLimitsProbe,
  type RuntimeCapabilities,
} from "./capabilities";

export interface RuntimeInfo {
  capabilities: RuntimeCapabilities;
  /** `undefined` while the WebGPU adapter is being probed, `null` if unavailable. */
  gpuLimits: GpuLimitsProbe | null | undefined;
}

/**
 * Only call from components that render after an upload (tool panels): they never
 * render on the server, so reading `navigator` during the first render is safe.
 */
export function useRuntimeCapabilities(): RuntimeInfo {
  const [capabilities] = useState(detectRuntimeCapabilities);
  const [gpuLimits, setGpuLimits] = useState<GpuLimitsProbe | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void probeWebGpuLimits().then((limits) => {
      if (!cancelled) {
        setGpuLimits(limits);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { capabilities, gpuLimits };
}
