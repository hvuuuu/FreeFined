"use client";

import { Button } from "@/components/ui/button";
import type { ToolMode } from "@/lib/enhancer/models";
import { cn } from "@/lib/utils";
import { Scissors, Wand2, RefreshCw, type LucideIcon } from "lucide-react";

interface ToolModeSelectorProps {
  value: ToolMode;
  disabled?: boolean;
  onChange: (mode: ToolMode) => void;
}

const TOOL_OPTIONS: Array<{
  id: ToolMode;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: "enhance", label: "Enhance", Icon: Wand2 },
  { id: "remove-background", label: "Remove BG", Icon: Scissors },
  { id: "convert", label: "Convert", Icon: RefreshCw },
];

export function ToolModeSelector({
  value,
  disabled = false,
  onChange,
}: ToolModeSelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Image tool"
      className="mx-auto grid w-full max-w-md grid-cols-3 gap-1 rounded-lg border border-border/70 bg-card/70 p-1 shadow-sm"
    >
      {TOOL_OPTIONS.map((option) => {
        const isSelected = value === option.id;

        return (
          <Button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={disabled}
            variant="ghost"
            onClick={() => onChange(option.id)}
            className={cn(
              "h-10 cursor-pointer gap-1 rounded-md text-xs font-medium sm:text-sm",
              isSelected
                ? "bg-red-500 text-white shadow-sm hover:bg-red-600 hover:text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <option.Icon className="h-4 w-4" aria-hidden="true" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
