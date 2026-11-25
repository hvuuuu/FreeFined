/**
 * Builds a download name from the source file name, e.g.
 * `outputFileName("cat.jpg", { suffix: "-enhanced", extension: "png" })` → `"cat-enhanced.png"`.
 * A leading dot (`.hidden`) is part of the name, not an extension.
 */
export function outputFileName(
  sourceName: string,
  { suffix = "", extension }: { suffix?: string; extension: string },
): string {
  const lastDot = sourceName.lastIndexOf(".");
  const baseName = lastDot > 0 ? sourceName.slice(0, lastDot) : sourceName;
  return `${baseName}${suffix}.${extension}`;
}
