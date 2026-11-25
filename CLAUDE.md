# FreeFined

Browser-only image tools (enhance, remove background, convert) on Next.js 16. Images never leave
the browser: every tool runs in a Web Worker.

## Commands

- `pnpm dev` / `pnpm build` (both copy the ONNX Runtime assets first)
- `pnpm check` runs format check, lint, both type checks and unit tests (what CI's first job runs)
- `pnpm e2e` runs the Playwright tests; they need `pnpm models:install u2netp super-resolution-lite`

## Map

- `app/`: routes only. `app/tools.ts` lists the tools the home page renders.
- `features/<tool>/`: one folder per tool. `index.ts` exports its `ToolDefinition` and is the only
  file other code may import from a feature.
- `shared/`: worker-job (main thread ↔ worker), inference (ONNX Runtime), image helpers,
  `models/registry.json`, runtime detection, upload validation.
- `components/`: shared UI (`components/ui` is shadcn).
- `docs/decisions/`: why the structure and toolchain are the way they are.

## Adding or changing a tool

Follow `features/convert`, the reference implementation:
`formats.ts` (pure, DOM-free, unit-tested) → `convert.worker.ts` (`serveJobs`) →
`use-convert.ts` (`useWorkerJob`) → `convert-panel.tsx` (switch on job status) → `index.ts`.
Then add it to `app/tools.ts`.

## Judgment calls the tooling cannot check

- Expected failures are values (`JobOutcome` with `ok: false`); throw only for bugs.
- Model ids, URLs and hashes change only in `shared/models/registry.json`, with a SHA-256 from a
  source you trust.
- When the same mistake happens twice, prefer a lint rule or a type over a new line in this file.
