import type { JobError, JobEvent, JobRequest } from "./protocol";

export type JobState<TValue> =
  | { status: "idle" }
  | { status: "running"; progress: number; stage: string }
  | { status: "done"; value: TValue }
  | { status: "failed"; error: JobError };

/** The subset of `Worker` the controller uses; a real `Worker` satisfies it. */
export interface WorkerLike<TInput, TResult> {
  postMessage(request: JobRequest<TInput>): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<JobEvent<TResult>>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface JobControllerOptions<TInput, TResult, TValue> {
  createWorker: () => WorkerLike<TInput, TResult>;
  timeoutMs: number;
  /** Converts the worker result into what the UI holds, e.g. a Blob into an object URL. */
  toValue: (result: TResult) => TValue;
  /** Releases what `toValue` allocated. Called when the value is replaced, reset or unmounted. */
  dispose?: (value: TValue) => void;
}

export interface JobController<TInput, TValue> {
  getSnapshot: () => JobState<TValue>;
  subscribe: (listener: () => void) => () => void;
  start: (input: TInput) => void;
  /** Stops the running job by terminating its worker; the next `start` spawns a fresh one. */
  cancel: () => void;
  reset: () => void;
  dispose: () => void;
}

/**
 * Owns one worker and at most one running job. Framework-free so its lifecycle
 * rules (stale responses, timeout, cancel, disposal) are unit-testable;
 * `useWorkerJob` adapts it to React.
 */
export function createJobController<TInput, TResult, TValue>(
  options: JobControllerOptions<TInput, TResult, TValue>,
): JobController<TInput, TValue> {
  let state: JobState<TValue> = { status: "idle" };
  const listeners = new Set<() => void>();
  let worker: WorkerLike<TInput, TResult> | null = null;
  let activeRequestId: number | null = null;
  let nextRequestId = 1;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let held: { value: TValue } | null = null;

  function setState(next: JobState<TValue>) {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function releaseValue() {
    if (held) {
      options.dispose?.(held.value);
      held = null;
    }
  }

  function endActiveJob() {
    clearTimeout(timeoutId);
    activeRequestId = null;
  }

  function stopWorker() {
    endActiveJob();
    worker?.terminate();
    worker = null;
  }

  function handleEvent(event: JobEvent<TResult>) {
    if (event.requestId !== activeRequestId) {
      return;
    }

    switch (event.type) {
      case "progress":
        setState({
          status: "running",
          progress: event.progress,
          stage: event.stage,
        });
        return;
      case "done": {
        endActiveJob();
        const value = options.toValue(event.result);
        held = { value };
        setState({ status: "done", value });
        return;
      }
      case "failed":
        endActiveJob();
        setState({ status: "failed", error: event.error });
        return;
    }
  }

  function getWorker(): WorkerLike<TInput, TResult> {
    if (worker) {
      return worker;
    }

    const created = options.createWorker();
    created.onmessage = (event) => {
      handleEvent(event.data);
    };
    created.onerror = (event) => {
      stopWorker();
      setState({
        status: "failed",
        error: {
          code: "worker-crashed",
          message: event.message || "The worker stopped unexpectedly.",
        },
      });
    };
    worker = created;
    return created;
  }

  return {
    getSnapshot: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start(input) {
      releaseValue();
      endActiveJob();

      const requestId = nextRequestId++;
      activeRequestId = requestId;
      timeoutId = setTimeout(() => {
        stopWorker();
        setState({
          status: "failed",
          error: {
            code: "timeout",
            message: `Processing took longer than ${Math.round(options.timeoutMs / 1000)}s and was stopped.`,
          },
        });
      }, options.timeoutMs);

      setState({ status: "running", progress: 0, stage: "Starting…" });
      getWorker().postMessage({ type: "start", requestId, input });
    },

    cancel() {
      stopWorker();
      setState({ status: "idle" });
    },

    reset() {
      stopWorker();
      releaseValue();
      setState({ status: "idle" });
    },

    dispose() {
      stopWorker();
      releaseValue();
      state = { status: "idle" };
    },
  };
}
