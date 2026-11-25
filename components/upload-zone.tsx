"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UploadCopy } from "@/shared/tools/tool-definition";
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
import {
  ACCEPT_ATTRIBUTE,
  processUploadFile,
  type SourceImage,
} from "@/shared/upload/process-upload";

interface UploadZoneProps {
  copy: UploadCopy;
  onFileSelected: (source: SourceImage) => void;
}

export function UploadZone({ copy, onFileSelected }: UploadZoneProps) {
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
      if (!result.ok) {
        setError(result.error);
        setWarning(null);
      } else {
        setError(null);
        setWarning(result.source.warning);
        onFileSelected(result.source);
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
      <div className="space-y-2 text-center sm:space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
          {copy.title}
          <span className="bg-linear-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">
            {copy.highlight}
          </span>
        </h1>
        <p className="text-muted-foreground text-xs text-pretty sm:text-sm md:text-base">
          {copy.description}
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
          "group bg-card/50 hover:bg-card/80 focus-visible:ring-ring flex w-full cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-4 py-12 transition-all duration-300 hover:border-red-500/60 focus-visible:ring-2 focus-visible:outline-none sm:gap-4 sm:px-6 sm:py-16 md:py-20",
          isDragging && "scale-[1.01] border-red-500 bg-red-500/5",
          isDecodingHeic &&
            "hover:border-border hover:bg-card/50 cursor-not-allowed",
        )}
      >
        {isDecodingHeic ? (
          <div className="flex animate-pulse flex-col items-center gap-2.5 text-center text-sm text-red-400">
            <RefreshCw className="h-6 w-6 animate-spin text-red-500" />
            <p className="text-foreground font-semibold">
              Decoding iPhone HEIC image...
            </p>
            <p className="text-muted-foreground text-xs">
              This runs entirely in your browser and may take a moment.
            </p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-red-500/20 to-rose-500/20 ring-1 ring-red-500/30 transition-transform duration-300 group-hover:scale-110 sm:h-16 sm:w-16",
                isDragging && "scale-110",
              )}
            >
              {isDragging ? (
                <ImageIcon
                  className="h-6 w-6 text-red-400 sm:h-7 sm:w-7"
                  aria-hidden="true"
                />
              ) : (
                <Upload
                  className="h-6 w-6 text-red-400 sm:h-7 sm:w-7"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-semibold sm:text-base md:text-lg">
                {isDragging ? "Release to upload" : "Drop your image here"}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">
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
        <p role="alert" className="text-destructive text-xs sm:text-sm">
          {error}
        </p>
      )}
      {!error && warning && (
        <p role="status" className="text-xs text-amber-500 sm:text-sm">
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

      <p className="text-muted-foreground max-w-7xl text-center text-xs leading-relaxed sm:text-sm">
        {copy.footnote}
      </p>

      <nav
        aria-label="Product information"
        className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium sm:text-sm"
      >
        <Link
          href="/about"
          className="hover:text-foreground focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          About FreeFined
        </Link>
        <span aria-hidden="true" className="text-border">
          /
        </span>
        <Link
          href="/privacy"
          className="hover:text-foreground focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Privacy
        </Link>
      </nav>
    </section>
  );
}
