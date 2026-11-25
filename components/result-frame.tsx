"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Download, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

interface ResultFrameProps {
  title: string;
  /** The tool-specific result view, e.g. a CompareSlider. */
  children: ReactNode;
  warning?: string | null;
  footnote?: string;
  download: { url: string; fileName: string; label: string };
  onReset: () => void;
}

/** Shared layout for a finished job: title, result view, download and "try another" actions. */
export function ResultFrame({
  title,
  children,
  warning,
  footnote,
  download,
  onReset,
}: ResultFrameProps) {
  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
      </div>

      {warning && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:text-sm">
          <p className="flex items-start justify-center gap-2 text-center">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{warning}</span>
          </p>
        </div>
      )}

      {children}

      {footnote && (
        <p className="text-muted-foreground text-center text-xs sm:text-sm">
          {footnote}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <Button
          variant="ghost"
          onClick={onReset}
          className="w-full cursor-pointer text-xs sm:w-auto sm:text-sm"
        >
          <RotateCcw
            className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4"
            aria-hidden="true"
          />
          Try Another Image
        </Button>
        <Button
          asChild
          className="w-full cursor-pointer bg-linear-to-r from-red-500 to-rose-500 text-xs text-white hover:from-red-600 hover:to-rose-600 sm:w-auto sm:text-sm"
        >
          <a href={download.url} download={download.fileName}>
            <Download
              className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4"
              aria-hidden="true"
            />
            {download.label}
          </a>
        </Button>
      </div>
    </section>
  );
}
