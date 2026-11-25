// Downloads ONNX models into public/models (optional: the API route proxies upstream when a
// file is missing) and verifies each against its pinned SHA-256.
//
//   pnpm models:install                      all models
//   pnpm models:install u2netp super-resolution-lite

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import registry from "../shared/models/registry.json" with { type: "json" };

const modelsDir = path.join(import.meta.dirname, "..", "public", "models");

function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex").toUpperCase()));
  });
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

const requested = process.argv.slice(2);
const unknown = requested.filter((id) => !Object.hasOwn(registry, id));
if (unknown.length > 0) {
  console.error(
    `Unknown model id(s): ${unknown.join(", ")}. Known: ${Object.keys(registry).join(", ")}`,
  );
  process.exit(1);
}

const models = Object.entries(registry).filter(
  ([id]) => requested.length === 0 || requested.includes(id),
);
await mkdir(modelsDir, { recursive: true });

for (const [id, model] of models) {
  const target = path.join(modelsDir, model.file);

  if (
    (await exists(target)) &&
    (model.sha256 === null || (await sha256(target)) === model.sha256)
  ) {
    console.log(`skip ${id}: already present`);
    continue;
  }

  console.log(`download ${id}...`);
  const response = await fetch(model.upstreamUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(
      `Download failed for ${id}: ${response.status} ${response.statusText}`,
    );
  }
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));

  const actual = await sha256(target);
  if (model.sha256 === null) {
    console.warn(
      `  ${id} has no pinned hash. To pin it, set "sha256": "${actual}" in shared/models/registry.json`,
    );
  } else if (actual !== model.sha256) {
    throw new Error(
      `Checksum mismatch for ${id}: expected ${model.sha256}, got ${actual}`,
    );
  }
  console.log(`ok ${id}`);
}
