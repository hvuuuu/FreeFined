import type { RuntimeCapabilities } from "@/shared/runtime/capabilities";
import { describe, expect, it } from "vitest";
import {
  createBackgroundRemovalPlan,
  resolveBackgroundRemovalMode,
} from "./runtime-plan";

const strongWebGpu: RuntimeCapabilities = {
  hasWebGPU: true,
  hasWebGL: true,
  isMobile: false,
  deviceMemory: 16,
  hardwareConcurrency: 12,
  saveData: false,
  effectiveConnectionType: "4g",
};
const smallImage = { width: 1200, height: 800 };
const discreteGpu = { maxStorageBuffersPerShaderStage: 1_000_000 };
const integratedGpu = { maxStorageBuffersPerShaderStage: 64 };

describe("createBackgroundRemovalPlan", () => {
  it("uses BiRefNet on a strong device whose GPU has enough storage buffers", () => {
    expect(
      createBackgroundRemovalPlan(strongWebGpu, smallImage, discreteGpu).mode,
    ).toBe("birefnet-lite-fp16");
  });

  it("avoids BiRefNet on integrated GPUs that would crash at dispatch", () => {
    expect(
      createBackgroundRemovalPlan(strongWebGpu, smallImage, integratedGpu),
    ).toMatchObject({
      mode: "u2netp",
      backend: "webgpu",
    });
  });

  it("avoids BiRefNet while the GPU probe has not answered yet", () => {
    expect(
      createBackgroundRemovalPlan(strongWebGpu, smallImage, undefined).mode,
    ).toBe("u2netp");
  });

  it("prefers the small model for large images and slow networks", () => {
    const largeImage = { width: 4000, height: 3000 };
    expect(
      createBackgroundRemovalPlan(strongWebGpu, largeImage, discreteGpu).mode,
    ).toBe("u2netp");
    expect(
      createBackgroundRemovalPlan(
        { ...strongWebGpu, saveData: true },
        smallImage,
        discreteGpu,
      ).mode,
    ).toBe("u2netp");
  });

  it("falls back to WASM without WebGPU", () => {
    expect(
      createBackgroundRemovalPlan(
        { ...strongWebGpu, hasWebGPU: false },
        smallImage,
        null,
      ),
    ).toMatchObject({ mode: "u2netp", backend: "wasm" });
  });
});

describe("resolveBackgroundRemovalMode", () => {
  const plan = createBackgroundRemovalPlan(
    strongWebGpu,
    smallImage,
    discreteGpu,
  );

  it("follows the plan for auto and the preset otherwise", () => {
    expect(resolveBackgroundRemovalMode("auto", plan, true)).toBe(
      "birefnet-lite-fp16",
    );
    expect(resolveBackgroundRemovalMode("fast", plan, true)).toBe("u2netp");
  });

  it("never picks the WebGPU-only model without WebGPU", () => {
    expect(resolveBackgroundRemovalMode("quality", plan, false)).toBe("u2netp");
  });
});
