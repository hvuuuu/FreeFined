"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createJobController,
  type JobControllerOptions,
  type JobState,
} from "./job-controller";

export interface WorkerJob<TInput, TValue> {
  state: JobState<TValue>;
  start: (input: TInput) => void;
  cancel: () => void;
  reset: () => void;
}

/**
 * Runs jobs in a Web Worker. `options` are read once on mount; the worker is
 * created on the first `start` and terminated on unmount.
 */
export function useWorkerJob<TInput, TResult, TValue>(
  options: JobControllerOptions<TInput, TResult, TValue>,
): WorkerJob<TInput, TValue> {
  const [controller] = useState(() => createJobController(options));

  useEffect(() => controller.dispose, [controller]);

  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  return {
    state,
    start: controller.start,
    cancel: controller.cancel,
    reset: controller.reset,
  };
}
