const SOFT_MAX_DIMENSION = 3000
const HARD_MAX_DIMENSION = 6000

export interface ImageSizeAssessment {
  width: number
  height: number
  maxDimension: number
  warning: string | null
  blockingError: string | null
}

export function assessImageDimensions(
  width: number,
  height: number,
): ImageSizeAssessment {
  const maxDimension = Math.max(width, height)

  if (maxDimension > HARD_MAX_DIMENSION) {
    return {
      width,
      height,
      maxDimension,
      warning: null,
      blockingError:
        "Image is too large for browser-safe enhancement. Maximum allowed dimension is 6000px.",
    }
  }

  if (maxDimension > SOFT_MAX_DIMENSION) {
    return {
      width,
      height,
      maxDimension,
      warning:
        "Large image detected (>3000px). Enhancement may be slower, but it is still allowed.",
      blockingError: null,
    }
  }

  return {
    width,
    height,
    maxDimension,
    warning: null,
    blockingError: null,
  }
}

export { HARD_MAX_DIMENSION, SOFT_MAX_DIMENSION }
