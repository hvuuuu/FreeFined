"use client";

// Shared building blocks for the options card of model-based tools (enhance, remove background).

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
import {
  BACKEND_LABELS,
  type InferenceBackend,
} from "@/shared/inference/backend";
import { cn } from "@/lib/utils";
import { AlertTriangle, Star, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function QualityStars({ value }: { value: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      title={`${value} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "h-3.5 w-3.5 sm:h-4 sm:w-4",
            index < value
              ? "fill-amber-500 text-amber-500"
              : "fill-muted text-muted/30",
          )}
        />
      ))}
    </div>
  );
}

interface RuntimeSummaryProps {
  conditionLabel: string;
  conditionHint: string;
  qualityStars: number;
  recommendation: string;
  /** Shown when the user overrides the automatic choice. */
  selected: string | null;
}

export function RuntimeSummary({
  conditionLabel,
  conditionHint,
  qualityStars,
  recommendation,
  selected,
}: RuntimeSummaryProps) {
  return (
    <div className="border-border/50 bg-card/40 rounded-md border p-3 text-xs sm:text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{conditionLabel}</p>
          <p className="text-muted-foreground">{conditionHint}</p>
        </div>
        <QualityStars value={qualityStars} />
      </div>
      <p className="text-muted-foreground mt-2">
        Auto recommendation: {recommendation}
      </p>
      {selected && (
        <p className="text-muted-foreground mt-1">Selected: {selected}</p>
      )}
    </div>
  );
}

export interface PresetOption<TId extends string> {
  id: TId;
  label: string;
  description: string;
  modelLabel: string;
  icon: LucideIcon;
  recommended: boolean;
  /** When set, the preset is disabled and this short reason is shown as a badge. */
  unavailableReason: string | null;
}

interface PresetGridProps<TId extends string> {
  title: string;
  options: readonly PresetOption<TId>[];
  selected: TId;
  onSelect: (id: TId) => void;
}

export function PresetGrid<TId extends string>({
  title,
  options,
  selected,
  onSelect,
}: PresetGridProps<TId>) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium sm:text-sm">{title}</p>
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2" role="radiogroup" aria-label={title}>
          {options.map((option) => {
            const isSelected = option.id === selected;
            const isUnavailable = option.unavailableReason !== null;

            return (
              <Button
                key={option.id}
                variant="outline"
                role="radio"
                aria-checked={isSelected}
                disabled={isUnavailable}
                onClick={() => onSelect(option.id)}
                className={cn(
                  "h-auto min-h-28 min-w-38 flex-col items-start justify-start gap-1 rounded-lg border p-2 text-left whitespace-normal transition-all sm:gap-1.5 sm:p-2.5",
                  isSelected
                    ? "border-red-500 bg-red-500/10"
                    : "border-border/50 bg-card/50 hover:bg-card/80 hover:border-red-500/50",
                  isUnavailable && "cursor-not-allowed opacity-50",
                )}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <option.icon className="h-4 w-4" />
                  <p className="text-xs font-medium sm:text-sm">
                    {option.label}
                  </p>
                </div>
                <p className="text-muted-foreground text-[10px] sm:text-xs">
                  {option.description}
                </p>
                <p className="text-muted-foreground text-[10px] sm:text-xs">
                  Model: {option.modelLabel}
                </p>
                {option.recommended && (
                  <Badge
                    variant="outline"
                    className="w-fit border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-300 sm:text-xs"
                  >
                    Recommended
                  </Badge>
                )}
                {option.unavailableReason && (
                  <Badge
                    variant="outline"
                    className="w-fit text-[10px] sm:text-xs"
                  >
                    {option.unavailableReason}
                  </Badge>
                )}
                {isSelected && (
                  <Badge
                    variant="default"
                    className="w-fit bg-red-500 text-[10px] hover:bg-red-600 sm:text-xs"
                  >
                    Selected
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export interface EngineOption {
  backend: InferenceBackend;
  icon: LucideIcon;
  expectedTime: string;
  supported: boolean;
}

export function EngineGrid({
  options,
  active,
}: {
  options: readonly EngineOption[];
  active: InferenceBackend;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium sm:text-sm">Processing Engine</p>
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {options.map((option) => {
            const isActive = option.backend === active;

            return (
              <div
                key={option.backend}
                className={cn(
                  "flex min-w-32 flex-col gap-1 rounded-lg border p-2 text-left transition-all sm:gap-1.5 sm:p-2.5",
                  isActive
                    ? "border-red-500 bg-red-500/10"
                    : option.supported
                      ? "border-border/50 bg-card/50"
                      : "border-border/30 bg-muted/30 opacity-50",
                )}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <option.icon className="h-3.5 w-3.5" />
                  <p className="text-xs font-medium sm:text-sm">
                    {BACKEND_LABELS[option.backend]}
                  </p>
                </div>
                <p className="text-muted-foreground text-[10px] sm:text-xs">
                  {option.expectedTime}
                </p>
                {isActive && (
                  <Badge
                    variant="default"
                    className="w-fit bg-red-500 text-[10px] hover:bg-red-600 sm:text-xs"
                  >
                    Active
                  </Badge>
                )}
                {!option.supported && (
                  <Badge
                    variant="outline"
                    className="w-fit text-[10px] sm:text-xs"
                  >
                    Unavailable
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

interface InferenceOptionsCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  warning: string | null;
  children: ReactNode;
  action: { label: string; onClick: () => void };
}

export function InferenceOptionsCard({
  icon: Icon,
  title,
  description,
  warning,
  children,
  action,
}: InferenceOptionsCardProps) {
  return (
    <Card>
      <CardHeader className="p-4 py-0! pb-2 sm:p-5 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Icon className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
          <span>{title}</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5 px-4 sm:space-y-3">
        {warning && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:text-sm">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </p>
          </div>
        )}
        {children}
        <Button
          onClick={action.onClick}
          size="lg"
          className="w-full cursor-pointer bg-linear-to-r from-red-500 to-rose-500 text-sm text-white hover:from-red-600 hover:to-rose-600 sm:text-base"
        >
          <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
          {action.label}
        </Button>
      </CardContent>
    </Card>
  );
}
