import { describe, expect, it } from "vitest";
import { clamp01, clampToByte } from "./pixels";

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
