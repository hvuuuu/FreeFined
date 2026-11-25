// Shared by the convert worker and the main thread, so it must stay DOM-free.

export type OutputFormat = "png" | "jpeg" | "webp" | "avif";

export interface OutputFormatSpec {
  label: string;
  mime: string;
  extension: string;
  description: string;
  supportsAlpha: boolean;
  hasQualityControl: boolean;
}

export const OUTPUT_FORMATS: Record<OutputFormat, OutputFormatSpec> = {
  png: {
    label: "PNG",
    mime: "image/png",
    extension: "png",
    description: "Lossless, transparent, high quality",
    supportsAlpha: true,
    hasQualityControl: false,
  },
  jpeg: {
    label: "JPEG",
    mime: "image/jpeg",
    extension: "jpg",
    description: "Standard photo compression, no alpha",
    supportsAlpha: false,
    hasQualityControl: true,
  },
  webp: {
    label: "WebP",
    mime: "image/webp",
    extension: "webp",
    description: "Modern, high compression, supports alpha",
    supportsAlpha: true,
    hasQualityControl: true,
  },
  avif: {
    label: "AVIF",
    mime: "image/avif",
    extension: "avif",
    description: "Next-gen codec, extremely small file size",
    supportsAlpha: true,
    hasQualityControl: false,
  },
};

export const OUTPUT_FORMAT_ORDER: readonly OutputFormat[] = [
  "png",
  "jpeg",
  "webp",
  "avif",
];

export const MIN_QUALITY = 10;
export const MAX_QUALITY = 100;
export const DEFAULT_QUALITY = 90;

export interface ConvertInput {
  file: File;
  format: OutputFormat;
  /** Percentage, MIN_QUALITY–MAX_QUALITY. Ignored by formats without quality control. */
  quality: number;
}

export interface ConvertResult {
  blob: Blob;
  format: OutputFormat;
}

export type ConvertErrorCode =
  "decode-failed" | "encode-failed" | "unsupported-format";

/** The `quality` argument for `convertToBlob`, which expects 0–1 and only applies to some formats. */
export function encoderQuality(
  format: OutputFormat,
  quality: number,
): number | undefined {
  if (!OUTPUT_FORMATS[format].hasQualityControl) {
    return undefined;
  }
  const clamped = Math.min(
    MAX_QUALITY,
    Math.max(MIN_QUALITY, Math.round(quality)),
  );
  return clamped / 100;
}

/**
 * Browsers silently fall back to PNG when they cannot encode the requested type,
 * so the produced blob's type is the only reliable signal of support.
 */
export function isEncodedAs(blob: Blob, format: OutputFormat): boolean {
  return blob.type === OUTPUT_FORMATS[format].mime;
}
