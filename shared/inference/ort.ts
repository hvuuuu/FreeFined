// Worker-side ONNX Runtime helpers shared by every model-based tool.

export type OrtModule = typeof import("onnxruntime-web/all");
export type OrtSession = Awaited<
  ReturnType<OrtModule["InferenceSession"]["create"]>
>;

/** Copied from node_modules by scripts/copy-ort-assets.ts before dev/build. */
const ORT_ASSET_BASE_PATH = "/ort/";

let ortModulePromise: Promise<OrtModule> | null = null;

export function getOrtModule(): Promise<OrtModule> {
  ortModulePromise ??= import("onnxruntime-web/all").then((ort) => {
    ort.env.logLevel = "error";
    ort.env.wasm.wasmPaths = ORT_ASSET_BASE_PATH;
    ort.env.wasm.proxy = false;
    ort.env.wasm.numThreads = 1;
    return ort;
  });
  return ortModulePromise;
}

export interface TensorMeta {
  name: string;
  isTensor: boolean;
  type: string;
  shape: (number | string)[];
}

/** ORT exposes input metadata as an array in some builds and a name-keyed map in others. */
export function getInputMetadata(
  session: OrtSession,
  name: string,
): TensorMeta | null {
  const metadata = (session as { inputMetadata?: unknown }).inputMetadata;

  if (Array.isArray(metadata)) {
    const found: unknown = metadata.find(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { name?: unknown }).name === name,
    );
    return typeof found === "object" && found !== null
      ? (found as TensorMeta)
      : null;
  }

  if (typeof metadata === "object" && metadata !== null) {
    const entry = (metadata as Record<string, unknown>)[name];
    return typeof entry === "object" && entry !== null
      ? (entry as TensorMeta)
      : null;
  }

  return null;
}

/** A positive numeric dimension, or `null` for dynamic (symbolic) dimensions. */
export function resolveFixedDimension(
  value: number | string | undefined,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

export function getSessionIO(session: OrtSession): {
  inputName: string;
  outputName: string;
} {
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName) {
    throw new Error("ONNX session is missing input/output names.");
  }
  return { inputName, outputName };
}
