"use client";

import { revokeObjectUrl, withObjectUrl } from "@/shared/worker-job/object-url";
import { useWorkerJob } from "@/shared/worker-job/use-worker-job";
import type { EnhanceInput, EnhanceResult } from "./models";

export type EnhancedImage = EnhanceResult & { url: string };

/** After this long on WASM the worker retries with the Fast model. */
export const ENHANCE_SOFT_TIMEOUT_MS = 90_000;

/** Hard stop for a hung worker: covers a first-time model download on a slow link plus one fallback run. */
const ENHANCE_TIMEOUT_MS = 10 * 60_000;

export function useEnhance() {
  return useWorkerJob<EnhanceInput, EnhanceResult, EnhancedImage>({
    createWorker: () =>
      new Worker(new URL("./enhance.worker.ts", import.meta.url)),
    timeoutMs: ENHANCE_TIMEOUT_MS,
    toValue: withObjectUrl,
    dispose: revokeObjectUrl,
  });
}
