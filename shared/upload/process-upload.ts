import { assessImageDimensions } from "@/shared/image/image-size";

/** An uploaded image that passed validation. Every tool receives one of these. */
export interface SourceImage {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  warning: string | null;
}

export type UploadResult =
  { ok: true; source: SourceImage } | { ok: false; error: string };

export const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

export const ACCEPT_ATTRIBUTE =
  ".jpeg,.jpg,.png,.webp,.avif,.heic,.heif,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";

function fileExtension(file: File): string | undefined {
  return file.name.split(".").pop()?.toLowerCase();
}

function isHeicFile(file: File): boolean {
  const extension = fileExtension(file);
  return (
    extension === "heic" ||
    extension === "heif" ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

export function getUploadError(file: File): string | null {
  const isAvif = fileExtension(file) === "avif" || file.type === "image/avif";

  if (!ACCEPTED_MIME_TYPES.has(file.type) && !isHeicFile(file) && !isAvif) {
    return "Unsupported file type. Please use JPG, PNG, WEBP, AVIF, or HEIC.";
  }

  if (file.size > MAX_SIZE_BYTES) {
    return "File is too large. Maximum size is 10MB.";
  }

  return null;
}

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read image dimensions"));
    };

    image.src = objectUrl;
  });
}

async function decodeHeic(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({ blob: file, toType: "image/png" });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!blob) {
    throw new Error("HEIC file contained no images");
  }
  const name = file.name.replace(/\.(heic|heif)$/i, ".png");
  return new File([blob], name, { type: "image/png" });
}

/**
 * Validates an uploaded file, decodes HEIC to PNG, and checks dimensions.
 * The caller owns `source.previewUrl` and must revoke it when done.
 */
export async function processUploadFile(
  file: File,
  onDecodingHeicChange?: (decoding: boolean) => void,
): Promise<UploadResult> {
  const validationError = getUploadError(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  let imageFile = file;
  let heicWarning: string | null = null;

  if (isHeicFile(file)) {
    onDecodingHeicChange?.(true);
    try {
      imageFile = await decodeHeic(file);
      heicWarning = "HEIC format auto-converted to PNG for browser support.";
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "unsupported HEIC file format";
      return { ok: false, error: `Could not decode HEIC image: ${reason}` };
    } finally {
      onDecodingHeicChange?.(false);
    }
  }

  let dimensions: { width: number; height: number };
  try {
    dimensions = await readImageDimensions(imageFile);
  } catch {
    return {
      ok: false,
      error: "Unable to load image dimensions. Please try another file.",
    };
  }

  const assessment = assessImageDimensions(dimensions.width, dimensions.height);
  if (assessment.blockingError) {
    return { ok: false, error: assessment.blockingError };
  }

  return {
    ok: true,
    source: {
      file: imageFile,
      previewUrl: URL.createObjectURL(imageFile),
      width: dimensions.width,
      height: dimensions.height,
      warning: heicWarning ?? assessment.warning,
    },
  };
}
