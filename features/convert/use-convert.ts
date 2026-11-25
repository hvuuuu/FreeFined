"use client";

import { revokeObjectUrl, withObjectUrl } from "@/shared/worker-job/object-url";
import { useWorkerJob } from "@/shared/worker-job/use-worker-job";
import type { ConvertInput, ConvertResult } from "./formats";

export type ConvertedImage = ConvertResult & { url: string };

const CONVERT_TIMEOUT_MS = 60_000;

export function useConvert() {
  return useWorkerJob<ConvertInput, ConvertResult, ConvertedImage>({
    createWorker: () =>
      new Worker(new URL("./convert.worker.ts", import.meta.url)),
    timeoutMs: CONVERT_TIMEOUT_MS,
    toValue: withObjectUrl,
    dispose: revokeObjectUrl,
  });
}
