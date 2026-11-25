/** Also the ONNX Runtime execution provider name for that backend. */
export type InferenceBackend = "webgpu" | "webgl" | "wasm";

export const BACKEND_LABELS: Record<InferenceBackend, string> = {
  webgpu: "WebGPU",
  webgl: "WebGL",
  wasm: "WASM",
};
