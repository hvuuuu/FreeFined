"use client";

import { useEffect, useState } from "react";
import { OUTPUT_FORMATS, isEncodedAs, type OutputFormat } from "./formats";

export type EncodableFormats = Record<OutputFormat, boolean>;

/** Uses the same API as the worker (OffscreenCanvas) so the answer matches what the worker can do. */
async function canEncode(format: OutputFormat): Promise<boolean> {
  if (typeof OffscreenCanvas === "undefined") {
    return false;
  }
  try {
    const canvas = new OffscreenCanvas(1, 1);
    canvas.getContext("2d");
    const blob = await canvas.convertToBlob({
      type: OUTPUT_FORMATS[format].mime,
    });
    return isEncodedAs(blob, format);
  } catch {
    return false;
  }
}

async function probeEncodableFormats(): Promise<EncodableFormats> {
  const [png, jpeg, webp, avif] = await Promise.all([
    canEncode("png"),
    canEncode("jpeg"),
    canEncode("webp"),
    canEncode("avif"),
  ]);
  return { png, jpeg, webp, avif };
}

/** `null` while probing. */
export function useEncodableFormats(): EncodableFormats | null {
  const [formats, setFormats] = useState<EncodableFormats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void probeEncodableFormats().then((result) => {
      if (!cancelled) {
        setFormats(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return formats;
}
