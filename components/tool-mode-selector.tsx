"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ToolOption<TId extends string> {
  id: TId;
  label: string;
  icon: LucideIcon;
}

interface ToolModeSelectorProps<TId extends string> {
  tools: readonly ToolOption<TId>[];
  value: TId;
  disabled?: boolean;
  onChange: (id: TId) => void;
}

export function ToolModeSelector<TId extends string>({
  tools,
  value,
  disabled = false,
  onChange,
}: ToolModeSelectorProps<TId>) {
  return (
    <div
      role="tablist"
      aria-label="Image tool"
      className="border-border/70 bg-card/70 mx-auto grid w-full max-w-md gap-1 rounded-lg border p-1 shadow-sm"
      style={{ gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))` }}
    >
      {tools.map((tool) => {
        const isSelected = value === tool.id;

        return (
          <Button
            key={tool.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={disabled}
            variant="ghost"
            onClick={() => onChange(tool.id)}
            className={cn(
              "h-10 cursor-pointer gap-1 rounded-md text-xs font-medium sm:text-sm",
              isSelected
                ? "bg-red-500 text-white shadow-sm hover:bg-red-600 hover:text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tool.icon className="h-4 w-4" aria-hidden="true" />
            {tool.label}
          </Button>
        );
      })}
    </div>
  );
}
