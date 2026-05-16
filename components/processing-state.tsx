"use client"

import { X, Wand2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { InferenceBackend } from "@/lib/enhancer/runtime-plan"

interface ProcessingStateProps {
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
  progress,
  stage,
  backend,
  estimatedTime,
  onCancel,
}: ProcessingStateProps) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
      <Card className="border-border/70">
        <CardHeader className="pb-4 sm:pb-5">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex-1 space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Wand2 className="h-4 w-4 shrink-0 animate-pulse text-red-400 sm:h-5 sm:w-5" aria-hidden="true" />
                <span>Enhancing your image</span>
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
        <CardContent className="space-y-3">
          <Progress value={progress} aria-label="Enhancement progress" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{stage}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Skeleton className="h-4 w-20 sm:h-5 sm:w-24" />
        <Skeleton className="aspect-4/3 w-full sm:aspect-video" />
      </div>
    </div>
  )
}
