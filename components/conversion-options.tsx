"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ACCEPT_ATTRIBUTE,
  processUploadFile,
  type UploadSelection,
} from "@/components/upload-zone";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  FileImage,
  RefreshCw,
  Sliders,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";

interface ConversionOptionsProps {
  previewUrl: string;
  fileName: string;
  targetFormat: "png" | "jpeg" | "webp" | "avif";
  quality: number;
  sizeWarning: string | null;
  workerWarning: string | null;
  onFormatChange: (format: "png" | "jpeg" | "webp" | "avif") => void;
  onQualityChange: (quality: number) => void;
  onConvert: () => void;
  onFileSelected: (selection: UploadSelection) => void;
}

const FORMAT_OPTIONS = [
  {
    id: "png" as const,
    label: "PNG",
    mime: "image/png",
    description: "Lossless, transparent, high quality",
  },
  {
    id: "jpeg" as const,
    label: "JPEG",
    mime: "image/jpeg",
    description: "Standard photo compression, no alpha",
  },
  {
    id: "webp" as const,
    label: "WebP",
    mime: "image/webp",
    description: "Modern, high compression, supports alpha",
  },
  {
    id: "avif" as const,
    label: "AVIF",
    mime: "image/avif",
    description: "Next-gen codec, extremely small file size",
  },
];

function checkMimeTypeSupport(mime: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL(mime).indexOf(mime) !== -1;
  } catch {
    return false;
  }
}

export function ConversionOptions({
  previewUrl,
  fileName,
  targetFormat,
  quality,
  sizeWarning,
  workerWarning,
  onFormatChange,
  onQualityChange,
  onConvert,
  onFileSelected,
}: ConversionOptionsProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDecodingHeic, setIsDecodingHeic] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [supportedFormats, setSupportedFormats] = useState<
    Record<string, boolean>
  >({
    png: true,
    jpeg: true,
    webp: true,
    avif: true,
  });

  useEffect(() => {
    const checkSupport = () => {
      setSupportedFormats({
        png: checkMimeTypeSupport("image/png"),
        jpeg: checkMimeTypeSupport("image/jpeg"),
        webp: checkMimeTypeSupport("image/webp"),
        avif: checkMimeTypeSupport("image/avif"),
      });
    };

    const timer = setTimeout(checkSupport, 0);
    return () => clearTimeout(timer);
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const result = await processUploadFile(file, setIsDecodingHeic);
        if (result.error) {
          setUploadError(result.error);
        } else if (result.selection) {
          setUploadError(null);
          onFileSelected(result.selection);
        }
      }
      if (event.target) {
        event.target.value = "";
      }
    },
    [onFileSelected],
  );

  const showSlider = targetFormat === "jpeg" || targetFormat === "webp";

  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-8">
      <Card className="mx-auto w-full max-w-[20rem] overflow-hidden md:max-w-md lg:max-w-none">
        <div className="relative mx-auto aspect-4/5 w-full bg-transparent sm:aspect-4/3 lg:aspect-square">
          {isDecodingHeic ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <RefreshCw className="h-6 w-6 animate-spin text-red-500" />
              <p className="text-xs font-medium text-foreground animate-pulse">
                Decoding HEIC...
              </p>
            </div>
          ) : (
            <Image
              src={previewUrl || "/placeholder.svg"}
              alt="Selected image preview"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 70vw, 40vw"
              unoptimized
              className="h-full w-full object-contain p-1.5 sm:p-2"
            />
          )}
        </div>
        <CardContent className="flex flex-col gap-2 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p
              className="min-w-0 flex-1 truncate text-xs sm:text-sm text-muted-foreground"
              title={fileName}
            >
              {fileName}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={openFilePicker}
              disabled={isDecodingHeic}
              className="shrink-0 cursor-pointer text-xs sm:text-sm"
            >
              Change
            </Button>
          </div>
          {uploadError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-400 sm:text-sm">
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{uploadError}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        disabled={isDecodingHeic}
      />

      <Card>
        <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <RefreshCw
              className="h-4 w-4 text-red-500 shrink-0"
              aria-hidden="true"
            />
            <span>Conversion Options</span>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Select output format and customize options below to convert your
            image.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-4 sm:px-5">
          {(sizeWarning || workerWarning) && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:text-sm">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{workerWarning ?? sizeWarning}</span>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-xs sm:text-sm font-semibold tracking-wide text-foreground">
              Target Format
            </label>
            <ScrollArea className="w-full mt-2">
              <div className="flex gap-2">
                {FORMAT_OPTIONS.map((opt) => {
                  const isSelected = targetFormat === opt.id;
                  const isSupported = supportedFormats[opt.id];

                  return (
                    <Button
                      key={opt.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => {
                        if (isSupported) onFormatChange(opt.id);
                      }}
                      disabled={!isSupported}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 size-24 shrink-0 rounded-lg border text-center transition-all cursor-pointer select-none whitespace-normal",
                        isSelected
                          ? "border-red-500 bg-red-500/10 text-foreground hover:bg-red-500/15"
                          : "border-border/50 bg-card/50 hover:border-red-500/30 hover:bg-card/80 text-muted-foreground hover:text-foreground",
                        !isSupported &&
                          "opacity-40 cursor-not-allowed hover:border-border hover:bg-card/50",
                      )}
                    >
                      <FileImage
                        className={cn(
                          "h-6 w-6 mb-1.5",
                          isSelected ? "text-red-500" : "text-muted-foreground",
                        )}
                      />
                      <span className="text-xs sm:text-sm font-bold">
                        {opt.label}
                      </span>
                      {!isSupported && (
                        <span className="text-[9px] mt-0.5 font-normal text-red-500">
                          Unsupported
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {showSlider && (
            <div className="space-y-3 rounded-lg border border-border/40 bg-muted/10 p-3 sm:p-4">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 font-medium">
                  <Sliders className="h-4 w-4 text-red-400" />
                  <span>Compression Quality</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-semibold tabular-nums border-red-500/30 text-red-400 bg-red-500/5"
                >
                  {quality}%
                </Badge>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={(e) => onQualityChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-lg bg-border accent-red-500 cursor-pointer focus:outline-none"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Higher quality preserves finer details but yields larger file
                sizes. Recommended default is 90%.
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/20 border border-border/20 p-2.5 sm:p-3 rounded-lg space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Conversion Info</span>
            </p>
            <p>
              • Selected Target:{" "}
              <span className="font-semibold text-foreground">
                {targetFormat.toUpperCase()}
              </span>
            </p>
            <p>
              • Mode:{" "}
              <span className="font-semibold text-foreground">
                {FORMAT_OPTIONS.find((f) => f.id === targetFormat)?.description}
              </span>
            </p>
            <p>
              • Processing Location:{" "}
              <span className="font-semibold text-foreground">
                Local Browser (HTML5 Canvas)
              </span>
            </p>
          </div>

          <Separator className="border-border/30" />

          <Button
            type="button"
            onClick={onConvert}
            className="w-full cursor-pointer bg-linear-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 font-medium py-5 text-sm sm:text-base shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20"
          >
            Convert Image
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
