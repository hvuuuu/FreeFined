// `toValue` / `dispose` pair for jobs whose result carries a Blob the UI needs to display.

export function withObjectUrl<TResult extends { blob: Blob }>(
  result: TResult,
): TResult & { url: string } {
  return { ...result, url: URL.createObjectURL(result.blob) };
}

export function revokeObjectUrl(value: { url: string }): void {
  URL.revokeObjectURL(value.url);
}
