# FreeFined

FreeFined is a free, browser-first AI image tool built with Next.js. It lets users upload an image, enhance it, or remove its background with client-side ONNX inference when available, then download the result without creating an account.

## Highlights

- One-click image upload for JPG, PNG, and WEBP files up to 10 MB.
- Browser-safe size checks with a warning above 3000 px and a hard limit above 6000 px.
- Auto runtime planning across WebGPU, WebGL, and WASM.
- Enhancement presets for Auto, Quality, Balanced, and Fast output.
- Background removal presets for Auto, Quality, and Fast transparent PNG output.
- ONNX model loading with Cache API and IndexedDB caching in the browser.
- Worker-based image processing so the UI stays responsive during enhancement and background removal.
- Built-in fallback paths when a model cannot load or initialize.
- Before/after enhancement comparison, transparent background preview, and direct result download.
- SEO metadata, sitemap, robots config, and production-only Vercel Analytics.

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

By default, models are served from `public/models` when downloaded locally, otherwise they are fetched from pinned upstream URLs through the Next.js API route and cached in the browser. If the enhancement model fetch or ONNX session setup fails, the worker falls back to canvas-based enhancement filters. If BiRefNet-lite cannot load or initialize, background removal retries with U2Netp.

Optional local model/runtime setup:

```powershell
$env:DOWNLOAD_MODELS=1
pnpm models:install
```

The script can download model files into `public/models` and copies ONNX Runtime WebAssembly assets into `public/ort`.

## Project Structure

```text
app/                  Next.js app routes, metadata, sitemap, robots, model API
components/           Upload, tool controls, preview, theme, and UI parts
lib/enhancer/         Runtime planning, model metadata, model cache, tiling, limits
workers/              Web Worker enhancement and background removal pipelines
public/               Logo, robots file, model notes, and ONNX runtime assets
scripts/              Local model and ONNX runtime asset installer
styles/               Shared style assets
```

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

- Processing happens in a browser worker after the image is selected.
- Uploaded images are not sent to an application backend for processing.
- The model API route only proxies ONNX model files from the pinned upstream URLs.
