// Copies the ONNX Runtime WebAssembly files from node_modules into public/ort, so the
// served runtime always matches the installed onnxruntime-web version. Runs before dev and build.

import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ORT_ASSETS = [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];

const root = path.join(import.meta.dirname, "..");
const sourceDir = path.join(root, "node_modules", "onnxruntime-web", "dist");
const targetDir = path.join(root, "public", "ort");

await mkdir(targetDir, { recursive: true });
await Promise.all(
  ORT_ASSETS.map((file) =>
    copyFile(path.join(sourceDir, file), path.join(targetDir, file)),
  ),
);
console.log(`Copied ${ORT_ASSETS.length} ONNX Runtime assets to public/ort`);
