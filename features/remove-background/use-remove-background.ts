"use client";

import { revokeObjectUrl, withObjectUrl } from "@/shared/worker-job/object-url";
import { useWorkerJob } from "@/shared/worker-job/use-worker-job";
import type { RemoveBackgroundInput, RemoveBackgroundResult } from "./models";

export type CutoutImage = RemoveBackgroundResult & { url: string };

/** The worker reports a timeout if inference alone takes longer than this. */
export const REMOVE_BACKGROUND_SOFT_TIMEOUT_MS = 120_000;

/** Hard stop for a hung worker: covers a first-time model download on a slow link plus one fallback run. */
const REMOVE_BACKGROUND_TIMEOUT_MS = 10 * 60_000;

export function useRemoveBackground() {
  return useWorkerJob<
    RemoveBackgroundInput,
    RemoveBackgroundResult,
    CutoutImage
  >({
    createWorker: () =>
      new Worker(new URL("./remove-background.worker.ts", import.meta.url)),
    timeoutMs: REMOVE_BACKGROUND_TIMEOUT_MS,
    toValue: withObjectUrl,
    dispose: revokeObjectUrl,
  });
}
