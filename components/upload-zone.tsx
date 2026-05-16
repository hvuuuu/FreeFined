"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { assessImageDimensions } from "@/lib/enhancer/image-size";
import { cn } from "@/lib/utils";
import {
  BanknoteX,
  FlagOff,
  ImageIcon,
  ShieldOff,
  Sparkles as SparklesIcon,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

export interface UploadSelection {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  warning: string | null;
}

interface UploadZoneProps {
  onFileSelected: (selection: UploadSelection) => void;
}

export const MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const ACCEPTED_MIME_SET = new Set<string>(ACCEPTED_MIME_TYPES);
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(",");

export function getUploadError(file: File): string | null {
  if (!ACCEPTED_MIME_SET.has(file.type)) {
    return "Unsupported file type. Please use JPG, PNG, or WEBP.";
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
): Promise<{ selection?: UploadSelection; error?: string }> {
  const nextError = getUploadError(file);
  if (nextError) return { error: nextError };

  try {
    const { width, height } = await readImageDimensions(file);
    const imageSizeAssessment = assessImageDimensions(width, height);
    if (imageSizeAssessment.blockingError) {
      return { error: imageSizeAssessment.blockingError };
    }

    return {
      selection: {
        file,
        previewUrl: URL.createObjectURL(file),
        width,
        height,
        warning: imageSizeAssessment.warning,
      },
    };
  } catch {
    return {
      error: "Unable to load image dimensions. Please try another file.",
    };
  }
}

export function UploadZone({ onFileSelected }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      const result = await processUploadFile(file);
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
      const file = event.dataTransfer.files?.[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile],
  );

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFilePicker();
      }
    },
    [openFilePicker],
  );

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6">
      <div className="space-y-2 sm:space-y-3 text-center">
        <h1 className="text-balance text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
          FreeFined AI image enhancer for{" "}
          <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">
            one-click upscaling
          </span>
        </h1>
        <p className="text-pretty text-xs sm:text-sm md:text-base text-muted-foreground">
          Upscale, denoise, and sharpen JPG, PNG, and WEBP photos in seconds. No
          account, no limits.
        </p>
      </div>

      <Card
        role="button"
        tabIndex={0}
        aria-label="Upload image by dragging or clicking"
        onClick={openFilePicker}
        onKeyDown={handleCardKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "group flex w-full cursor-pointer flex-col items-center justify-center gap-3 sm:gap-4 border-2 border-dashed bg-card/50 px-4 sm:px-6 py-12 sm:py-16 md:py-20 transition-all duration-300 hover:border-red-500/60 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging && "scale-[1.01] border-red-500 bg-red-500/5",
        )}
      >
        <div
          className={cn(
            "flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-rose-500/20 ring-1 ring-red-500/30 transition-transform duration-300 group-hover:scale-110",
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
            or click to browse - JPG, PNG, WEBP up to 10MB
          </p>
        </div>
        <Button
          variant="outline"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openFilePicker();
          }}
          className="cursor-pointer text-xs sm:text-sm"
        >
          Browse Files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={handleChange}
          aria-hidden="true"
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

      <p className="max-w-2xl text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
        FreeFined runs enhancement work in your browser with WebGPU, WebGL, or
        WASM when available, then lets you compare and download the result.
      </p>
    </section>
  );
}
