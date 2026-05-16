"use client"

import Image from "next/image"
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { ArrowLeftRight, Check, Download, RotateCcw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MODEL_SPECS, type EnhancementMode } from "@/lib/enhancer/models"

interface PreviewSectionProps {
  originalUrl: string
  enhancedUrl: string
  mode: EnhancementMode
  fileName: string
  onReset: () => void
}

const SLIDER_STEP = 2

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value))
}

function buildDownloadFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".")
  const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName
  const extension = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : ".png"

  return `${baseName}-enhanced${extension}`
}

export function PreviewSection({
  originalUrl,
  enhancedUrl,
  mode,
  fileName,
  onReset,
}: PreviewSectionProps) {
  const [sliderValue, setSliderValue] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const sliderAreaRef = useRef<HTMLDivElement | null>(null)

  const handleDownload = useCallback(() => {
    const link = document.createElement("a")
    link.href = enhancedUrl
    link.download = buildDownloadFileName(fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [enhancedUrl, fileName])

  const updateSliderFromClientX = useCallback((clientX: number) => {
    const area = sliderAreaRef.current
    if (!area) {
      return
    }

    const rect = area.getBoundingClientRect()
    if (rect.width === 0) {
      return
    }

    const nextValue = clampPercentage(((clientX - rect.left) / rect.width) * 100)
    setSliderValue(nextValue)
  }, [])

  const releasePointer = useCallback((event: PointerEvent<HTMLDivElement>) => {
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      setIsDragging(true)
      updateSliderFromClientX(event.clientX)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [updateSliderFromClientX],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isDragging) {
        return
      }
      updateSliderFromClientX(event.clientX)
    },
    [isDragging, updateSliderFromClientX],
  )

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      setSliderValue((prev) => clampPercentage(prev - SLIDER_STEP))
      return
    }

    if (event.key === "ArrowRight") {
      event.preventDefault()
      setSliderValue((prev) => clampPercentage(prev + SLIDER_STEP))
    }
  }, [])

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 sm:space-y-6">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold sm:text-lg">Enhancement complete</h2>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="secondary"
            className="bg-slate-500/15 text-xs text-slate-700 ring-1 ring-slate-500/30 hover:bg-slate-500/20 dark:text-slate-200 sm:text-sm"
          >
            Before
          </Badge>
          <Badge
            variant="secondary"
            className="bg-emerald-500/15 text-xs text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 sm:text-sm"
          >
            After
          </Badge>
        </div>

        <Card className="mx-auto w-full max-w-md overflow-hidden bg-muted ring-1 ring-red-500/20 sm:max-w-2xl">
          <div className="relative aspect-4/3 w-full overflow-hidden sm:aspect-16/10">
            <Image
              src={enhancedUrl || "/placeholder.svg"}
              alt="Enhanced image"
              fill
              sizes="(max-width: 640px) 100vw, 768px"
              unoptimized
              className="absolute inset-0 h-full w-full object-contain"
              style={{ filter: MODEL_SPECS[mode].fallbackFilter }}
            />

            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderValue}% 0 0)` }}>
              <Image
                src={originalUrl || "/placeholder.svg"}
                alt="Original image"
                fill
                sizes="(max-width: 640px) 100vw, 768px"
                unoptimized
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>

            <div
              ref={sliderAreaRef}
              role="slider"
              tabIndex={0}
              aria-label="Before and after comparison"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(sliderValue)}
              onKeyDown={handleKeyDown}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={releasePointer}
              onPointerCancel={releasePointer}
              className="absolute inset-0 z-20 cursor-ew-resize touch-none"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-10"
              style={{ left: `${sliderValue}%`, transform: "translateX(-50%)" }}
            >
              <div className="h-full w-0.5 bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
              <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-background/85 backdrop-blur-sm">
                <ArrowLeftRight className="h-4 w-4 text-foreground" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <Button variant="ghost" onClick={onReset} className="w-full cursor-pointer text-xs sm:w-auto sm:text-sm">
          <RotateCcw className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          Try Another Image
        </Button>
        <Button
          onClick={handleDownload}
          className="w-full cursor-pointer bg-linear-to-r from-red-500 to-rose-500 text-xs text-white hover:from-red-600 hover:to-rose-600 sm:w-auto sm:text-sm"
        >
          <Download className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          Download Enhanced
        </Button>
      </div>
    </section>
  )
}
