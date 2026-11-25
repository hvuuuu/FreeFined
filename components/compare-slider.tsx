"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeftRight } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

interface CompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
}

const KEYBOARD_STEP = 2;

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

/** Before/after image comparison with a draggable, keyboard-accessible divider. */
export function CompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
}: CompareSliderProps) {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  function moveTo(clientX: number) {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return;
    }
    setPosition(clampPercentage(((clientX - rect.left) / rect.width) * 100));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    setIsDragging(true);
    moveTo(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (isDragging) {
      moveTo(event.clientX);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -KEYBOARD_STEP : KEYBOARD_STEP;
      setPosition((previous) => clampPercentage(previous + step));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="secondary"
          className="bg-slate-500/15 text-xs text-slate-700 ring-1 ring-slate-500/30 hover:bg-slate-500/20 sm:text-sm dark:text-slate-200"
        >
          {beforeLabel}
        </Badge>
        <Badge
          variant="secondary"
          className="bg-emerald-500/15 text-xs text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 sm:text-sm"
        >
          {afterLabel}
        </Badge>
      </div>

      <Card className="bg-muted mx-auto w-full max-w-md overflow-hidden ring-1 ring-red-500/20 sm:max-w-2xl">
        <div className="relative aspect-4/3 w-full overflow-hidden sm:aspect-16/10">
          <Image
            src={afterUrl}
            alt={`${afterLabel} image`}
            fill
            sizes="(max-width: 640px) 100vw, 768px"
            unoptimized
            className="absolute inset-0 h-full w-full object-contain"
          />

          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <Image
              src={beforeUrl}
              alt={`${beforeLabel} image`}
              fill
              sizes="(max-width: 640px) 100vw, 768px"
              unoptimized
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>

          <div
            ref={areaRef}
            role="slider"
            tabIndex={0}
            aria-label={`${beforeLabel} and ${afterLabel} comparison`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="absolute inset-0 z-20 cursor-ew-resize touch-none"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{ left: `${position}%`, transform: "translateX(-50%)" }}
          >
            <div className="h-full w-0.5 bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
            <div className="bg-background/85 absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 backdrop-blur-sm">
              <ArrowLeftRight className="text-foreground h-4 w-4" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
