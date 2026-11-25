import {
  MODEL_REGISTRY,
  isModelId,
  type ModelId,
} from "@/shared/models/registry";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=0, s-maxage=31536000, immutable";

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function buildProxyHeaders(upstream: Headers) {
  const headers = new Headers({
    "Content-Type": upstream.get("content-type") ?? "application/octet-stream",
    "Cache-Control": CACHE_CONTROL,
  });
  for (const name of ["content-length", "etag", "last-modified"]) {
    const value = upstream.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

async function getLocalModelResponse(id: ModelId) {
  const localPath = path.join(
    process.cwd(),
    "public",
    "models",
    MODEL_REGISTRY[id].file,
  );

  try {
    const [modelStats, modelBuffer] = await Promise.all([
      stat(localPath),
      readFile(localPath),
    ]);

    return new Response(modelBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": modelStats.size.toString(),
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch {
    return null;
  }
}

/** Serves a model from public/models when present, otherwise proxies its pinned upstream URL. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isModelId(id)) {
    return textResponse("Unknown model id.", 404);
  }

  const localModelResponse = await getLocalModelResponse(id);
  if (localModelResponse) {
    return localModelResponse;
  }

  let upstream: Response;
  try {
    upstream = await fetch(MODEL_REGISTRY[id].upstreamUrl, {
      redirect: "follow",
    });
  } catch {
    return textResponse("Failed to fetch model from upstream.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text().catch(() => "");
    return textResponse(
      message || "Upstream model fetch failed.",
      upstream.status || 502,
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: buildProxyHeaders(upstream.headers),
  });
}
