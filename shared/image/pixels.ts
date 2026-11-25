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

/**
 * Reads `data[index]` in pixel/tensor loops whose bounds hold by construction.
 * Throws instead of returning `undefined`, which would silently turn into NaN pixels.
 */
export function at(data: ArrayLike<number>, index: number): number {
  const value = data[index];
  if (value === undefined) {
    throw new RangeError(
      `Index ${index} is out of bounds (length ${data.length}).`,
    );
  }
  return value;
}
