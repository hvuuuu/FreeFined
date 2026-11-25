import { describe, expect, it } from "vitest";
import { outputFileName } from "./file-name";

describe("outputFileName", () => {
  it("replaces the extension", () => {
    expect(outputFileName("holiday.png", { extension: "jpg" })).toBe(
      "holiday.jpg",
    );
    expect(outputFileName("scan.final.heic", { extension: "webp" })).toBe(
      "scan.final.webp",
    );
  });

  it("inserts the suffix before the new extension", () => {
    expect(
      outputFileName("cat.jpg", { suffix: "-enhanced", extension: "png" }),
    ).toBe("cat-enhanced.png");
  });

  it("appends an extension when the source has none", () => {
    expect(outputFileName("photo", { extension: "avif" })).toBe("photo.avif");
  });

  it("treats a leading dot as part of the name", () => {
    expect(outputFileName(".hidden", { extension: "png" })).toBe(".hidden.png");
  });
});
