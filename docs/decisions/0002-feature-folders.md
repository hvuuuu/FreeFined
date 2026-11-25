# 0002 — Feature folders with a worker-only tsconfig

- **Context:** `app/page.tsx` held all three tools (820 lines, ~25 `useState`), tool logic branched on `toolMode` in 4+ places, and the two workers duplicated helpers. Two boundaries matter: feature (convert vs enhance) and execution context (main thread vs worker).
- **Decision:** One folder per tool under `features/<tool>/` exposing a single `ToolDefinition` via `index.ts`; shared code in `shared/`, shared UI in `components/`. All tools run through one worker pattern (`shared/worker-job`). `*.worker.ts` files are type-checked by `tsconfig.worker.json` (webworker lib, no DOM), so anything a worker imports must be DOM-free.
- **Why:** Feature folders keep a change in one place; the worker tsconfig gives Squoosh-style context safety without a client/worker/shared folder split per feature (rejected as too much ceremony for three tools).
- **Revisit when:** a feature grows several workers or worker-safety errors become frequent — then split features into `client/` `worker/` `shared/` (Squoosh layout).
