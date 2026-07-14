"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { assessImageDimensions } from "@/lib/enhancer/image-size";
import type { ToolMode } from "@/lib/enhancer/models";
import { cn } from "@/lib/utils";
import {
  BanknoteX,
  FlagOff,
  ImageIcon,
  ShieldOff,
  Sparkles as SparklesIcon,
  Upload,
  RefreshCw,
} from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";

export interface UploadSelection {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  warning: string | null;
}

interface UploadZoneProps {
  toolMode?: ToolMode;
  onFileSelected: (selection: UploadSelection) => void;
}

export const MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;
export const ACCEPTED_MIME_SET = new Set<string>(ACCEPTED_MIME_TYPES);
export const ACCEPT_ATTRIBUTE = ".jpeg,.jpg,.png,.webp,.avif,.heic,.heif,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";

export function getUploadError(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const isHeic = extension === "heic" || extension === "heif" || file.type === "image/heic" || file.type === "image/heif";
  const isAvif = extension === "avif" || file.type === "image/avif";

  if (!ACCEPTED_MIME_SET.has(file.type) && !isHeic && !isAvif) {
    return "Unsupported file type. Please use JPG, PNG, WEBP, AVIF, or HEIC.";
  }

  if (file.size > MAX_SIZE_BYTES) {
    return "File is too large. Maximum size is 10MB.";
  }

  return null;
}

export function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read image dimensions"));
    };

    image.src = objectUrl;
  });
}

export async function processUploadFile(
  file: File,
  onConvertingChange?: (converting: boolean) => void,
): Promise<{ selection?: UploadSelection; error?: string }> {
  const nextError = getUploadError(file);
  if (nextError) return { error: nextError };

  let fileToProcess = file;
  let customWarning: string | null = null;

  const extension = file.name.split(".").pop()?.toLowerCase();
  const isHeic = extension === "heic" || extension === "heif" || file.type === "image/heic" || file.type === "image/heif";

  if (isHeic) {
    try {
      onConvertingChange?.(true);
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({
        blob: file,
        toType: "image/png",
      });
      const singleBlob = Array.isArray(converted) ? converted[0] : converted;
      const newName = file.name.replace(/\.(heic|heif)$/i, ".png");
      fileToProcess = new File([singleBlob], newName, { type: "image/png" });
      customWarning = "HEIC format auto-converted to PNG for browser support.";
    } catch (err: any) {
      return {
        error: `Could not decode HEIC image: ${err?.message || "unsupported HEIC file format"}`,
      };
    } finally {
      onConvertingChange?.(false);
    }
  }

  try {
    const { width, height } = await readImageDimensions(fileToProcess);
    const imageSizeAssessment = assessImageDimensions(width, height);
    if (imageSizeAssessment.blockingError) {
      return { error: imageSizeAssessment.blockingError };
    }

    return {
      selection: {
        file: fileToProcess,
        previewUrl: URL.createObjectURL(fileToProcess),
        width,
        height,
        warning: customWarning || imageSizeAssessment.warning,
      },
    };
  } catch {
    return {
      error: "Unable to load image dimensions. Please try another file.",
    };
  }
}

export function UploadZone({
  toolMode = "enhance",
  onFileSelected,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isDecodingHeic, setIsDecodingHeic] = useState(false);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      const result = await processUploadFile(file, setIsDecodingHeic);
      if (result.error) {
        setError(result.error);
        setWarning(null);
      } else if (result.selection) {
        setError(null);
        setWarning(result.selection.warning);
        onFileSelected(result.selection);
      }
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (isDecodingHeic) return;
      const file = event.dataTransfer.files?.[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile, isDecodingHeic],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (isDecodingHeic) return;
      const file = event.target.files?.[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile, isDecodingHeic],
  );

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isDecodingHeic) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFilePicker();
      }
    },
    [openFilePicker, isDecodingHeic],
  );

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6">
      <div className="space-y-2 sm:space-y-3 text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
          {toolMode === "remove-background"
            ? "FreeFined AI background remover for "
            : toolMode === "convert"
            ? "FreeFined AI image converter for "
            : "FreeFined AI image enhancer for "}
          <span className="bg-linear-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">
            {toolMode === "remove-background"
              ? "transparent images"
              : toolMode === "convert"
              ? "any format conversion"
              : "one-click upscaling"}
          </span>
        </h1>
        <p className="text-pretty text-xs sm:text-sm md:text-base text-muted-foreground">
          {toolMode === "remove-background"
            ? "Cut out the main subject from JPG, PNG, WEBP, AVIF, and HEIC images in your browser. No account, no watermark."
            : toolMode === "convert"
            ? "Convert JPG, PNG, WEBP, AVIF, and HEIC images to other formats client-side in seconds."
            : "Upscale, denoise, and sharpen JPG, PNG, WEBP, AVIF, and HEIC photos in seconds. No account, no limits."}
        </p>
      </div>

      <Card
        role="button"
        tabIndex={isDecodingHeic ? -1 : 0}
        aria-label="Upload image by dragging or clicking"
        onClick={() => {
          if (!isDecodingHeic) openFilePicker();
        }}
        onKeyDown={handleCardKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isDecodingHeic) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "group flex w-full cursor-pointer flex-col items-center justify-center gap-3 sm:gap-4 border-2 border-dashed bg-card/50 px-4 sm:px-6 py-12 sm:py-16 md:py-20 transition-all duration-300 hover:border-red-500/60 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging && "scale-[1.01] border-red-500 bg-red-500/5",
          isDecodingHeic && "cursor-not-allowed hover:border-border hover:bg-card/50",
        )}
      >
        {isDecodingHeic ? (
          <div className="flex flex-col items-center gap-2.5 text-center text-sm text-red-400 animate-pulse">
            <RefreshCw className="h-6 w-6 animate-spin text-red-500" />
            <p className="font-semibold text-foreground">Decoding iPhone HEIC image...</p>
            <p className="text-xs text-muted-foreground">This runs entirely in your browser and may take a moment.</p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-linear-to-br from-red-500/20 to-rose-500/20 ring-1 ring-red-500/30 transition-transform duration-300 group-hover:scale-110",
                isDragging && "scale-110",
              )}
            >
              {isDragging ? (
                <ImageIcon
                  className="h-6 w-6 sm:h-7 sm:w-7 text-red-400"
                  aria-hidden="true"
                />
              ) : (
                <Upload
                  className="h-6 w-6 sm:h-7 sm:w-7 text-red-400"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm sm:text-base md:text-lg font-semibold">
                {isDragging ? "Release to upload" : "Drop your image here"}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                or click to browse - JPG, PNG, WEBP, AVIF, HEIC up to 10MB
              </p>
            </div>
            <Button
              variant="outline"
              type="button"
              disabled={isDecodingHeic}
              onClick={(event) => {
                event.stopPropagation();
                openFilePicker();
              }}
              className="cursor-pointer text-xs sm:text-sm"
            >
              Browse Files
            </Button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={handleChange}
          aria-hidden="true"
          disabled={isDecodingHeic}
        />
      </Card>

      {error && (
        <p role="alert" className="text-xs sm:text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && warning && (
        <p role="status" className="text-xs sm:text-sm text-amber-500">
          {warning}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs">
          <ShieldOff className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
          No account needed
        </Badge>
        <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs">
          <BanknoteX className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
          No charge
        </Badge>
        <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs">
          <SparklesIcon className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
          No quality loss
        </Badge>
        <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs">
          <FlagOff className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
          No watermark added
        </Badge>
      </div>

      <p className="max-w-7xl text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {toolMode === "remove-background"
          ? "FreeFined runs background removal in your browser with WebGPU or WASM when available, then lets you download a transparent image."
          : toolMode === "convert"
          ? "FreeFined runs image conversion in your browser using HTML5 Canvas, ensuring privacy and speed."
          : "FreeFined runs enhancement work in your browser with WebGPU, WebGL, or WASM when available, then lets you compare and download the result."}
      </p>

      <nav
        aria-label="Product information"
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground sm:text-sm"
      >
        <Link
          href="/about"
          className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          About FreeFined
        </Link>
        <span aria-hidden="true" className="text-border">
          /
        </span>
        <Link
          href="/privacy"
          className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Privacy
        </Link>
      </nav>
    </section>
  );
}
