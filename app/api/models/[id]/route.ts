import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const MODEL_URLS = {
  "real-esrgan-x4":
    "https://huggingface.co/AXERA-TECH/Real-ESRGAN/resolve/main/onnx/realesrgan-x4.onnx?download=true",
  "realesrgan-general-x4v3":
    "https://huggingface.co/qualcomm/Real-ESRGAN-General-x4v3/resolve/e01c7edcbe5dc97b6a8f25507e639b43df49fa76/Real-ESRGAN-General-x4v3.onnx?download=true",
  "super-resolution-lite":
    "https://huggingface.co/onnxmodelzoo/super-resolution-10/resolve/main/super-resolution-10.onnx?download=true",
  "birefnet-lite-fp16":
    "https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model_fp16.onnx?download=true",
  u2netp:
    "https://huggingface.co/Heliosoph/u2net-onnx/resolve/main/u2netp.onnx?download=true",
} as const;

type ModelId = keyof typeof MODEL_URLS;

const LOCAL_MODEL_FILES: Record<ModelId, string> = {
  "real-esrgan-x4": "real-esrgan-x4.onnx",
  "realesrgan-general-x4v3": "realesrgan-general-x4v3.onnx",
  "super-resolution-lite": "super-resolution-lite.onnx",
  "birefnet-lite-fp16": "birefnet-lite-fp16.onnx",
  u2netp: "u2netp.onnx",
};

function isModelId(value: string): value is ModelId {
  return value in MODEL_URLS;
}

function buildProxyHeaders(upstream: Headers) {
  const headers = new Headers();
  const contentType = upstream.get("content-type");
  const contentLength = upstream.get("content-length");
  const etag = upstream.get("etag");
  const lastModified = upstream.get("last-modified");

  headers.set("Content-Type", contentType ?? "application/octet-stream");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }
  if (etag) {
    headers.set("ETag", etag);
  }
  if (lastModified) {
    headers.set("Last-Modified", lastModified);
  }
  headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=31536000, immutable",
  );

  return headers;
}

async function getLocalModelResponse(id: ModelId) {
  const localPath = path.join(
    process.cwd(),
    "public",
    "models",
    LOCAL_MODEL_FILES[id],
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
        "Cache-Control": "public, max-age=0, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isModelId(id)) {
    return new Response("Unknown model id.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const localModelResponse = await getLocalModelResponse(id);
  if (localModelResponse) {
    return localModelResponse;
  }

  let upstream: Response;
  try {
    upstream = await fetch(MODEL_URLS[id], { redirect: "follow" });
  } catch {
    return new Response("Failed to fetch model from upstream.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text().catch(() => "");
    return new Response(message || "Upstream model fetch failed.", {
      status: upstream.status || 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: buildProxyHeaders(upstream.headers),
  });
}
