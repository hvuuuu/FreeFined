# FreeFined

FreeFined is a free, browser-first AI image tool built with Next.js. It lets users upload an image, enhance it, remove its background with client-side ONNX inference, or convert its format locally, then download the result without creating an account.

## Highlights

- **One-click image upload** for JPG, PNG, WEBP, AVIF, and HEIC files up to 10 MB.
- **On-the-fly HEIC decoding** via `heic2any` directly in the browser, auto-converting iOS photos to PNG for instant editing.
- **Client-side image conversion** supporting PNG, JPEG, WebP, and AVIF target formats using OffscreenCanvas in a Web Worker.
- **Compression quality controls** (10% to 100% slider) for formats supporting lossy compression (JPEG & WebP).
- **Smart transparency handling** that auto-fills transparent background regions with solid white when converting to JPEG.
- **Feature support detection** to dynamically check browser compatibility for next-gen formats (like AVIF/WebP).
- **Browser-safe size checks** with a warning above 3000 px and a hard limit above 6000 px.
- **Auto runtime planning** for AI models across WebGPU, WebGL, and WASM.
- **Enhancement presets** for Auto, Quality, Balanced, and Fast output.
- **Background removal presets** for Auto, Quality, and Fast transparent PNG output.
- **ONNX model loading** with Cache API and IndexedDB caching in the browser.
- **Worker-based image processing** so the UI stays responsive during model inference (enhancement and background removal).
- **Built-in fallback paths** when a model cannot load or initialize (e.g. falling back to canvas filters or lightweight models).
- **Interactive features** including before/after enhancement comparison, transparent background preview, and direct result download.
- **SEO-optimized** with sitemap, robots config, metadata, and production-only Vercel Analytics.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI primitives
- ONNX Runtime Web
- pnpm

## Getting Started

Install dependencies:

```powershell
pnpm install
```

Start the development server:

```powershell
pnpm run dev
```

Open the app at:

```text
http://localhost:3000
```

Build for production:

```powershell
pnpm run build
pnpm run start
```

Run linting:

```powershell
pnpm run lint
```

## Search Console Verification

FreeFined can emit Google Search Console verification metadata during build.
Set either environment variable before deploying:

```powershell
$env:GOOGLE_SITE_VERIFICATION="your-google-token"
```

or:

```powershell
$env:NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION="your-google-token"
```

After deployment, verify `https://freefined.vercel.app/` in Google Search
Console and submit `https://freefined.vercel.app/sitemap.xml`.

## Model Runtime

The app exposes model endpoints from `app/api/models/[id]/route.ts` and currently supports:

- `real-esrgan-x4` for highest-quality general photo enhancement.
- `realesrgan-general-x4v3` for the default balanced path with much lower runtime and memory pressure.
- `super-resolution-lite` for the fastest compatibility fallback on weak devices.
- `birefnet-lite-fp16` for high-quality browser background removal on capable WebGPU devices.
- `u2netp` for lightweight background removal on constrained devices and fallback paths.

Model ids, upstream URLs and SHA-256 hashes live in one place: `shared/models/registry.json`. Models are served from `public/models` when downloaded locally, otherwise proxied from their pinned upstream URLs through the Next.js API route and cached in the browser. If the enhancement model fetch or ONNX session setup fails, the worker falls back to canvas-based enhancement filters. If BiRefNet-lite cannot load or initialize, background removal retries with U2Netp.

Optional local model download (all models, or only the ids you name):

```sh
pnpm models:install
pnpm models:install u2netp super-resolution-lite
```

ONNX Runtime WebAssembly files are copied from `node_modules` into `public/ort` automatically by `pnpm dev` and `pnpm build`, so they always match the installed `onnxruntime-web` version.

## Project Structure

```text
app/                  Routes only: page.tsx renders the tools listed in app/tools.ts; model API route
features/<tool>/      One folder per tool (convert, enhance, remove-background): UI, worker, pure logic, tests.
                      Each exposes a single ToolDefinition from index.ts.
shared/               Code used by several tools: worker-job (main thread <-> worker), inference (ONNX
                      Runtime), image helpers, model registry, runtime detection, upload validation
components/           Shared UI (components/ui is shadcn)
e2e/                  Playwright tests
scripts/              Model installer and ONNX Runtime asset copy
docs/decisions/       Architecture decision records
```

`features/convert` is the reference implementation: new tools should follow its shape.

## Troubleshooting

If `pnpm run dev` fails with:

```text
Cannot find module '...\node_modules\next\dist\bin\next'
```

the local `node_modules` tree is incomplete or has broken pnpm links. Recreate it from the lockfile:

```powershell
Remove-Item -LiteralPath .\node_modules -Recurse -Force
pnpm install
```

If pnpm then fails with:

```text
ERR_PNPM_IGNORED_BUILDS
```

approve the known native build scripts:

```powershell
pnpm approve-builds --all
```

This writes pnpm's build approvals to `pnpm-workspace.yaml`. Keep that file in the repo so future installs can pass pnpm's dependency checks.

## Notes

- **Client-side execution**: enhancement, background removal and format conversion all run inside browser Web Workers, so the UI stays responsive.
- **Privacy First**: Uploaded images are never sent to a remote backend; all conversion, decoding, enhancement, and background removal are done locally in your browser.
- **Model Proxying**: The Next.js API route only proxies ONNX model files from pinned upstream CDN URLs to ensure reliable delivery and browser caching.
