import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "sample.png");

/** Opens the home page, switches to a tool, and uploads the 16x16 RGBA fixture. */
export async function uploadFixture(page: Page, toolLabel: string) {
  await page.goto("/");
  await page.getByRole("tab", { name: toolLabel }).click();
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
}

/** Clicks a download link and returns the suggested file name and the downloaded bytes. */
export async function download(page: Page, linkName: string) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: linkName }).click();
  const file = await downloadPromise;
  return {
    name: file.suggestedFilename(),
    bytes: await readFile(await file.path()),
  };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Asserts the bytes are a PNG and returns its header fields. */
export function readPngHeader(bytes: Buffer) {
  expect([...bytes.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}
