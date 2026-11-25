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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  FileImage,
  RefreshCw,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  MAX_QUALITY,
  MIN_QUALITY,
  OUTPUT_FORMAT_ORDER,
  OUTPUT_FORMATS,
  type OutputFormat,
} from "./formats";
import type { EncodableFormats } from "./use-encodable-formats";

interface ConvertOptionsProps {
  format: OutputFormat;
  quality: number;
  /** `null` while the browser is being probed. */
  encodable: EncodableFormats | null;
  warning: string | null;
  onFormatChange: (format: OutputFormat) => void;
  onQualityChange: (quality: number) => void;
  onConvert: () => void;
}

export function ConvertOptions({
  format,
  quality,
  encodable,
  warning,
  onFormatChange,
  onQualityChange,
  onConvert,
}: ConvertOptionsProps) {
  const selected = OUTPUT_FORMATS[format];
  const canConvert = encodable?.[format] ?? false;

  return (
    <Card>
      <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <RefreshCw
            className="h-4 w-4 shrink-0 text-red-500"
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
        {warning && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:text-sm">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-foreground text-xs font-semibold tracking-wide sm:text-sm">
            Target Format
          </p>
          <ScrollArea className="mt-2 w-full">
            <div
              className="flex gap-2"
              role="radiogroup"
              aria-label="Target format"
            >
              {OUTPUT_FORMAT_ORDER.map((id) => {
                const spec = OUTPUT_FORMATS[id];
                const isSelected = format === id;
                const isSupported = encodable?.[id] ?? true;

                return (
                  <Button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => onFormatChange(id)}
                    disabled={!isSupported}
                    className={cn(
                      "flex size-24 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border p-2 text-center whitespace-normal transition-all select-none",
                      isSelected
                        ? "text-foreground border-red-500 bg-red-500/10 hover:bg-red-500/15"
                        : "border-border/50 bg-card/50 text-muted-foreground hover:bg-card/80 hover:text-foreground hover:border-red-500/30",
                      !isSupported &&
                        "hover:border-border hover:bg-card/50 cursor-not-allowed opacity-40",
                    )}
                  >
                    <FileImage
                      className={cn(
                        "mb-1.5 h-6 w-6",
                        isSelected ? "text-red-500" : "text-muted-foreground",
                      )}
                    />
                    <span className="text-xs font-bold sm:text-sm">
                      {spec.label}
                    </span>
                    {!isSupported && (
                      <span className="mt-0.5 text-[9px] font-normal text-red-500">
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

        {selected.hasQualityControl && (
          <div className="border-border/40 bg-muted/10 space-y-3 rounded-lg border p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <label
                htmlFor="convert-quality"
                className="flex items-center gap-1.5 font-medium"
              >
                <Sliders className="h-4 w-4 text-red-400" />
                <span>Compression Quality</span>
              </label>
              <Badge
                variant="outline"
                className="border-red-500/30 bg-red-500/5 text-xs font-semibold text-red-400 tabular-nums"
              >
                {quality}%
              </Badge>
            </div>
            <input
              id="convert-quality"
              type="range"
              min={MIN_QUALITY}
              max={MAX_QUALITY}
              value={quality}
              onChange={(event) => onQualityChange(Number(event.target.value))}
              className="bg-border h-1.5 w-full cursor-pointer rounded-lg accent-red-500 focus:outline-none"
            />
            <p className="text-muted-foreground text-[10px] sm:text-xs">
              Higher quality preserves finer details but yields larger file
              sizes. Recommended default is 90%.
            </p>
          </div>
        )}

        <div className="border-border/20 bg-muted/20 text-muted-foreground space-y-1 rounded-lg border p-2.5 text-xs sm:p-3">
          <p className="text-foreground flex items-center gap-1 font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Conversion Info</span>
          </p>
          <p>
            • Selected Target:{" "}
            <span className="text-foreground font-semibold">
              {selected.label}
            </span>
          </p>
          <p>
            • Mode:{" "}
            <span className="text-foreground font-semibold">
              {selected.description}
            </span>
          </p>
          <p>
            • Processing Location:{" "}
            <span className="text-foreground font-semibold">
              Local Browser (Web Worker)
            </span>
          </p>
        </div>

        <Separator className="border-border/30" />

        <Button
          type="button"
          onClick={onConvert}
          disabled={!canConvert}
          className="w-full cursor-pointer bg-linear-to-r from-red-500 to-rose-500 py-5 text-sm font-medium shadow-md shadow-red-500/10 hover:from-red-600 hover:to-rose-600 hover:shadow-lg hover:shadow-red-500/20 sm:text-base"
        >
          Convert Image
        </Button>
      </CardContent>
    </Card>
  );
}
