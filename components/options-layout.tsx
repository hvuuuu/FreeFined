"use client";

import { SourceCard } from "@/components/source-card";
import type { SourceImage } from "@/shared/upload/process-upload";
import type { ReactNode } from "react";

interface OptionsLayoutProps {
  source: SourceImage;
  onSourceChange: (source: SourceImage) => void;
  /** The tool's options card. */
  children: ReactNode;
}

/** Source preview on the left, tool options on the right (stacked on small screens). */
export function OptionsLayout({
  source,
  onSourceChange,
  children,
}: OptionsLayoutProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-8">
      <SourceCard source={source} onSourceChange={onSourceChange} />
      {children}
    </div>
  );
}
