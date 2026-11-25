import type { RuntimeCapabilities } from "@/shared/runtime/capabilities";
import { describe, expect, it } from "vitest";
import { resolvePresetMode } from "./models";
import { createEnhancementPlan } from "./runtime-plan";

const desktop: RuntimeCapabilities = {
  hasWebGPU: false,
  hasWebGL: false,
  isMobile: false,
  deviceMemory: 16,
  hardwareConcurrency: 12,
  saveData: false,
  effectiveConnectionType: "4g",
};

describe("createEnhancementPlan", () => {
  it("picks the quality model on a strong WebGPU desktop", () => {
    expect(
      createEnhancementPlan({ ...desktop, hasWebGPU: true }),
    ).toMatchObject({
      backend: "webgpu",
      mode: "real-esrgan-x4",
    });
  });

  it("keeps WebGPU but uses the efficient model on a constrained device", () => {
    expect(
      createEnhancementPlan({ ...desktop, hasWebGPU: true, isMobile: true }),
    ).toMatchObject({
      backend: "webgpu",
      mode: "realesrgan-general-x4v3",
    });
  });

  it("uses WebGL when WebGPU is missing", () => {
    expect(createEnhancementPlan({ ...desktop, hasWebGL: true })).toMatchObject(
      {
        backend: "webgl",
        mode: "realesrgan-general-x4v3",
      },
    );
  });

  it("falls back to WASM with the efficient model on a capable CPU", () => {
    expect(createEnhancementPlan(desktop)).toMatchObject({
      backend: "wasm",
      mode: "realesrgan-general-x4v3",
    });
  });

  it("uses the smallest model on a very weak CPU-only device", () => {
    expect(
      createEnhancementPlan({ ...desktop, hardwareConcurrency: 2 }),
    ).toMatchObject({
      backend: "wasm",
      mode: "super-resolution-lite",
    });
  });
});

describe("resolvePresetMode", () => {
  it("uses the automatic recommendation only for the auto preset", () => {
    expect(resolvePresetMode("auto", "real-esrgan-x4")).toBe("real-esrgan-x4");
    expect(resolvePresetMode("fast", "real-esrgan-x4")).toBe(
      "super-resolution-lite",
    );
  });
});
