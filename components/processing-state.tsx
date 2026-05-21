"use client"

import { Scissors, X, Wand2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { ToolMode } from "@/lib/enhancer/models"
import type { InferenceBackend } from "@/lib/enhancer/runtime-plan"

interface ProcessingStateProps {
  toolMode: ToolMode
  progress: number
  stage: string
  backend: InferenceBackend | null
  estimatedTime: string | null
  onCancel: () => void
}

function formatBackendLabel(backend: InferenceBackend | null) {
  if (!backend) {
    return "Auto"
  }
  return backend.toUpperCase()
}

export function ProcessingState({
  toolMode,
  progress,
  stage,
  backend,
  estimatedTime,
  onCancel,
}: ProcessingStateProps) {
  const isBackgroundRemoval = toolMode === "remove-background"
  const Icon = isBackgroundRemoval ? Scissors : Wand2
  const title = isBackgroundRemoval
    ? "Removing background"
    : "Enhancing your image"
  const progressLabel = isBackgroundRemoval
    ? "Background removal progress"
    : "Enhancement progress"

  return (
    <div className="mx-auto w-full max-w-md sm:max-w-2xl space-y-4 sm:space-y-5">
      <Card className="border-border/70 py-5">
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex-1 space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Icon className="h-4 w-4 shrink-0 animate-pulse text-red-400 sm:h-5 sm:w-5" aria-hidden="true" />
                <span>{title}</span>
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed sm:text-base">
                Running on {formatBackendLabel(backend)}{estimatedTime ? ` (${estimatedTime})` : ""}.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel} className="mt-1 shrink-0 cursor-pointer text-sm sm:mt-0">
              <X className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          <Progress value={progress} aria-label={progressLabel} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{stage}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Skeleton className="h-4 w-20 sm:h-5 sm:w-24 mx-auto sm:mx-0" />
        <Card className="overflow-hidden border-border/40 bg-muted/20 py-5">
          <Skeleton className="aspect-4/3 w-full sm:aspect-16/10" />
        </Card>
      </div>
    </div>
  )
}
