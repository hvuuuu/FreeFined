import type { JobEvent, JobRequest, JobRunner } from "./protocol";

/**
 * The subset of DedicatedWorkerGlobalScope that serveJobs needs. Taking it as a
 * parameter (instead of using `self`) keeps this module DOM-free and unit-testable.
 */
export interface JobPort<TInput, TResult> {
  postMessage(event: JobEvent<TResult>): void;
  onmessage: ((event: MessageEvent<JobRequest<TInput>>) => void) | null;
}

export function serveJobs<TInput, TResult>(
  port: JobPort<TInput, TResult>,
  run: JobRunner<TInput, TResult>,
): void {
  port.onmessage = (event) => {
    void handleRequest(port, run, event.data);
  };
}

async function handleRequest<TInput, TResult>(
  port: JobPort<TInput, TResult>,
  run: JobRunner<TInput, TResult>,
  request: JobRequest<TInput>,
): Promise<void> {
  const { requestId } = request;

  try {
    const outcome = await run(request.input, (progress, stage) => {
      port.postMessage({ type: "progress", requestId, progress, stage });
    });

    port.postMessage(
      outcome.ok
        ? { type: "done", requestId, result: outcome.value }
        : { type: "failed", requestId, error: outcome.error },
    );
  } catch (error) {
    port.postMessage({
      type: "failed",
      requestId,
      error: {
        code: "unexpected",
        message:
          error instanceof Error ? error.message : "Unexpected worker error.",
      },
    });
  }
}
