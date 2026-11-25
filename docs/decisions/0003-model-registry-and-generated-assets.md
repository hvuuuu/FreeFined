# 0003 — One model registry; runtime assets copied, not committed

- **Context:** Model ids/URLs/hashes lived in four places (API route, models.ts, PowerShell installer, README). ONNX Runtime `.wasm` files (38 MB) were committed and could drift from the installed `onnxruntime-web` version.
- **Decision:** A single registry module is the source of truth for models; the installer becomes a Node TypeScript script that reads it. ORT `.wasm` files are copied from `node_modules` before dev/build and `public/ort` is gitignored.
- **Why:** Adding a model is one edit; the runtime assets always match the package; the installer runs on Linux CI.
- **Revisit when:** models move to a CDN/storage bucket, or ORT is loaded from a CDN instead of self-hosted.
