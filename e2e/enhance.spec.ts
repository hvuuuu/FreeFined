import { expect, test } from "@playwright/test";
import { download, readPngHeader, uploadFixture } from "./helpers";

test("upscales an image with the Fast model and downloads a PNG", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await uploadFixture(page, "Enhance");

  await page.getByRole("radio", { name: /^Fast/ }).click();
  await page.getByRole("button", { name: "Enhance Image" }).click();

  await expect(
    page.getByRole("heading", { name: "Enhancement complete" }),
  ).toBeVisible({
    timeout: 150_000,
  });

  const file = await download(page, "Download Enhanced");
  expect(file.name).toBe("sample-enhanced.png");
  const png = readPngHeader(file.bytes);
  expect(png.width).toBeGreaterThan(16);
  expect(png.height).toBeGreaterThan(16);
});
