import registry from "./registry.json";

// The JSON file is the single source of truth: the API route, the workers and
// scripts/install-models.ts all read it.

export type ModelId = keyof typeof registry;

export interface ModelAsset {
  file: string;
  upstreamUrl: string;
  /** Uppercase hex SHA-256 of the file; the installer refuses files that do not match. */
  sha256: string;
}

export const MODEL_REGISTRY: Record<ModelId, ModelAsset> = registry;

export function isModelId(value: string): value is ModelId {
  return Object.hasOwn(MODEL_REGISTRY, value);
}

/** Same-origin URL the browser loads a model from (served by app/api/models/[id]). */
export function modelUrl(id: ModelId): string {
  return `/api/models/${id}`;
}
