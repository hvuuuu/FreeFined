import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJobController, type WorkerLike } from "./job-controller";
import type { JobEvent, JobRequest } from "./protocol";

class FakeWorker implements WorkerLike<string, string> {
  onmessage: ((event: MessageEvent<JobEvent<string>>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  requests: JobRequest<string>[] = [];
  terminated = false;

  postMessage(request: JobRequest<string>) {
    this.requests.push(request);
  }

  terminate() {
    this.terminated = true;
  }

  emit(event: JobEvent<string>) {
    this.onmessage?.(new MessageEvent("message", { data: event }));
  }

  lastRequestId(): number {
    const request = this.requests.at(-1);
    if (!request) {
      throw new Error("No request was posted");
    }
    return request.requestId;
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const disposed: string[] = [];
  const controller = createJobController<string, string, string>({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    timeoutMs: 1_000,
    toValue: (result) => `value:${result}`,
    dispose: (value) => disposed.push(value),
  });
  const currentWorker = () => {
    const worker = workers.at(-1);
    if (!worker) {
      throw new Error("No worker was created");
    }
    return worker;
  };
  return { controller, workers, disposed, currentWorker };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createJobController", () => {
  it("creates the worker lazily and reports progress then the mapped result", () => {
    const { controller, workers, currentWorker } = setup();
    expect(workers).toHaveLength(0);

    controller.start("input");
    const worker = currentWorker();
    const requestId = worker.lastRequestId();
    expect(controller.getSnapshot()).toMatchObject({
      status: "running",
      progress: 0,
    });

    worker.emit({
      type: "progress",
      requestId,
      progress: 40,
      stage: "Working",
    });
    expect(controller.getSnapshot()).toEqual({
      status: "running",
      progress: 40,
      stage: "Working",
    });

    worker.emit({ type: "done", requestId, result: "out" });
    expect(controller.getSnapshot()).toEqual({
      status: "done",
      value: "value:out",
    });
  });

  it("ignores events from a request that is no longer active", () => {
    const { controller, currentWorker } = setup();
    controller.start("first");
    const staleId = currentWorker().lastRequestId();

    controller.start("second");
    currentWorker().emit({ type: "done", requestId: staleId, result: "stale" });

    expect(controller.getSnapshot().status).toBe("running");
  });

  it("cancel terminates the worker so the next start spawns a fresh one", () => {
    const { controller, workers } = setup();
    controller.start("input");
    controller.cancel();

    expect(workers[0]?.terminated).toBe(true);
    expect(controller.getSnapshot()).toEqual({ status: "idle" });

    controller.start("again");
    expect(workers).toHaveLength(2);
  });

  it("fails with a timeout and stops the worker when no result arrives in time", () => {
    const { controller, currentWorker } = setup();
    controller.start("slow");

    vi.advanceTimersByTime(1_000);

    expect(currentWorker().terminated).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      status: "failed",
      error: { code: "timeout" },
    });
  });

  it("does not time out a job that already finished", () => {
    const { controller, currentWorker } = setup();
    controller.start("fast");
    const worker = currentWorker();
    worker.emit({
      type: "done",
      requestId: worker.lastRequestId(),
      result: "ok",
    });

    vi.advanceTimersByTime(5_000);

    expect(controller.getSnapshot().status).toBe("done");
    expect(worker.terminated).toBe(false);
  });

  it("disposes the previous value when it is replaced, reset, or the controller is disposed", () => {
    const { controller, disposed, currentWorker } = setup();
    const finish = (result: string) => {
      const worker = currentWorker();
      worker.emit({ type: "done", requestId: worker.lastRequestId(), result });
    };

    controller.start("a");
    finish("a");
    controller.start("b");
    expect(disposed).toEqual(["value:a"]);

    finish("b");
    controller.reset();
    expect(disposed).toEqual(["value:a", "value:b"]);

    controller.start("c");
    finish("c");
    controller.dispose();
    expect(disposed).toEqual(["value:a", "value:b", "value:c"]);
  });

  it("reports a worker crash as a failure and recovers on the next start", () => {
    const { controller, workers, currentWorker } = setup();
    controller.start("input");

    // Node has no ErrorEvent; the controller only reads `message`.
    currentWorker().onerror?.({ message: "boom" } as ErrorEvent);

    expect(controller.getSnapshot()).toEqual({
      status: "failed",
      error: { code: "worker-crashed", message: "boom" },
    });
    controller.start("retry");
    expect(workers).toHaveLength(2);
  });

  it("notifies subscribers on every state change until they unsubscribe", () => {
    const { controller } = setup();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    controller.start("input");
    controller.cancel();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    controller.start("again");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
