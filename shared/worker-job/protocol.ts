// Messages exchanged between `useWorkerJob` (main thread) and `serveJobs` (worker).
// Messages are not validated at runtime: both sides compile against these types.

export interface JobError {
  code: string;
  message: string;
}

/** Expected failures are values; only bugs are thrown. */
export type JobOutcome<TResult> =
  { ok: true; value: TResult } | { ok: false; error: JobError };

export interface JobRequest<TInput> {
  type: "start";
  requestId: number;
  input: TInput;
}

export type JobEvent<TResult> =
  | { type: "progress"; requestId: number; progress: number; stage: string }
  | { type: "done"; requestId: number; result: TResult }
  | { type: "failed"; requestId: number; error: JobError };

export type ReportProgress = (progress: number, stage: string) => void;

export type JobRunner<TInput, TResult> = (
  input: TInput,
  report: ReportProgress,
) => Promise<JobOutcome<TResult>>;
