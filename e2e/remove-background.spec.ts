import { expect, test } from "@playwright/test";
import { download, readPngHeader, uploadFixture } from "./helpers";

test("removes the background with the Fast model and downloads a transparent PNG", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await uploadFixture(page, "Remove BG");

  await page.getByRole("radio", { name: /^Fast/ }).click();
  await page.getByRole("button", { name: "Remove Background" }).click();

  await expect(
    page.getByRole("heading", { name: "Background removed" }),
  ).toBeVisible({
    timeout: 150_000,
  });

  const file = await download(page, "Download Transparent");
  expect(file.name).toBe("sample-no-bg.png");
  const png = readPngHeader(file.bytes);
  expect({ width: png.width, height: png.height }).toEqual({
    width: 16,
    height: 16,
  });
  expect(png.colorType).toBe(6);
});
