import { expect, test } from "@playwright/test";
import { download, uploadFixture } from "./helpers";

test("converts a PNG to a downloadable JPEG", async ({ page }) => {
  await uploadFixture(page, "Convert");

  const jpeg = page.getByRole("radio", { name: /JPEG/ });
  await expect(jpeg).toBeEnabled();
  await jpeg.click();
  await page.getByRole("button", { name: "Convert Image" }).click();

  await expect(
    page.getByRole("heading", { name: "Conversion complete" }),
  ).toBeVisible();

  const file = await download(page, "Download Converted");
  expect(file.name).toBe("sample.jpg");
  expect([...file.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
});
