import { describe, expect, it, vi } from "vitest";
import type { JobEvent, JobRequest, JobRunner } from "./protocol";
import { serveJobs, type JobPort } from "./serve-jobs";

function createPort() {
  const events: JobEvent<string>[] = [];
  const port: JobPort<number, string> = {
    onmessage: null,
    postMessage: (event) => events.push(event),
  };
  const send = (request: JobRequest<number>) =>
    port.onmessage?.(new MessageEvent("message", { data: request }));
  return { port, events, send };
}

describe("serveJobs", () => {
  it("forwards progress and posts the result tagged with the request id", async () => {
    const { port, events, send } = createPort();
    const run: JobRunner<number, string> = (input, report) => {
      report(50, "halfway");
      return Promise.resolve({ ok: true, value: `got ${input}` });
    };
    serveJobs(port, run);

    send({ type: "start", requestId: 7, input: 3 });

    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events).toEqual([
      { type: "progress", requestId: 7, progress: 50, stage: "halfway" },
      { type: "done", requestId: 7, result: "got 3" },
    ]);
  });

  it("posts expected failures returned by the runner", async () => {
    const { port, events, send } = createPort();
    serveJobs(port, () =>
      Promise.resolve({
        ok: false,
        error: { code: "bad-input", message: "nope" },
      }),
    );

    send({ type: "start", requestId: 1, input: 0 });

    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toEqual({
      type: "failed",
      requestId: 1,
      error: { code: "bad-input", message: "nope" },
    });
  });

  it("turns a thrown error into an 'unexpected' failure instead of crashing the worker", async () => {
    const { port, events, send } = createPort();
    serveJobs(port, () => Promise.reject(new Error("boom")));

    send({ type: "start", requestId: 2, input: 0 });

    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toEqual({
      type: "failed",
      requestId: 2,
      error: { code: "unexpected", message: "boom" },
    });
  });
});
