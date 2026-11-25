import { describe, expect, it } from "vitest";
import { at, clamp01, clampToByte } from "./pixels";

describe("clampToByte", () => {
  it("rounds into the 0–255 range", () => {
    expect(clampToByte(-4)).toBe(0);
    expect(clampToByte(127.6)).toBe(128);
    expect(clampToByte(300)).toBe(255);
  });
});

describe("clamp01", () => {
  it("keeps values inside 0–1", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(2)).toBe(1);
  });
});

describe("at", () => {
  it("returns in-range values, including zero", () => {
    const data = new Uint8ClampedArray([0, 128, 255]);
    expect(at(data, 0)).toBe(0);
    expect(at(data, 2)).toBe(255);
  });

  it("throws on out-of-range reads instead of yielding NaN later", () => {
    expect(() => at(new Float32Array(4), 4)).toThrow(RangeError);
  });
});
