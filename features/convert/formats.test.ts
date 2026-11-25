import { describe, expect, it } from "vitest";
import { encoderQuality, isEncodedAs } from "./formats";

describe("encoderQuality", () => {
  it("converts a percentage to the 0–1 range for formats with quality control", () => {
    expect(encoderQuality("jpeg", 90)).toBe(0.9);
    expect(encoderQuality("webp", 55)).toBe(0.55);
  });

  it("clamps out-of-range values instead of passing them to the encoder", () => {
    expect(encoderQuality("jpeg", 0)).toBe(0.1);
    expect(encoderQuality("jpeg", 250)).toBe(1);
  });

  it("returns undefined for formats that ignore quality", () => {
    expect(encoderQuality("png", 90)).toBeUndefined();
    expect(encoderQuality("avif", 90)).toBeUndefined();
  });
});

describe("isEncodedAs", () => {
  it("detects the browser's silent PNG fallback", () => {
    const fallback = new Blob([], { type: "image/png" });
    expect(isEncodedAs(fallback, "avif")).toBe(false);
    expect(isEncodedAs(fallback, "png")).toBe(true);
  });
});
