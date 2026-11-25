// DOM-free pixel helpers usable from workers.

export function clampToByte(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 255) {
    return 255;
  }
  return Math.round(value);
}

export function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

export function imageBitmapFromFile(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new Error(
      "Browser does not support createImageBitmap in Worker context.",
    );
  }
  return createImageBitmap(file);
}
