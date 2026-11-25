import type { JobOutcome, ReportProgress } from "@/shared/worker-job/protocol";
import { serveJobs } from "@/shared/worker-job/serve-jobs";
import {
  OUTPUT_FORMATS,
  encoderQuality,
  isEncodedAs,
  type ConvertErrorCode,
  type ConvertInput,
  type ConvertResult,
} from "./formats";

function failure(
  code: ConvertErrorCode,
  message: string,
): JobOutcome<ConvertResult> {
  return { ok: false, error: { code, message } };
}

async function convert(
  input: ConvertInput,
  report: ReportProgress,
): Promise<JobOutcome<ConvertResult>> {
  const spec = OUTPUT_FORMATS[input.format];

  report(10, "Decoding image…");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(input.file);
  } catch {
    return failure("decode-failed", "This image could not be decoded.");
  }

  report(40, "Drawing image…");
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return failure(
      "encode-failed",
      "Could not create a 2D canvas in this browser.",
    );
  }

  if (!spec.supportsAlpha) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  report(70, `Encoding ${spec.label}…`);
  const blob = await canvas.convertToBlob({
    type: spec.mime,
    quality: encoderQuality(input.format, input.quality),
  });

  if (!isEncodedAs(blob, input.format)) {
    return failure(
      "unsupported-format",
      `This browser cannot encode ${spec.label} images.`,
    );
  }

  return { ok: true, value: { blob, format: input.format } };
}

serveJobs(self, convert);
