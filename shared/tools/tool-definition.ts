import type { SourceImage } from "@/shared/upload/process-upload";
import type { LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export interface ToolPanelProps {
  source: SourceImage;
  onSourceChange: (source: SourceImage) => void;
  /** Return to the upload screen. */
  onReset: () => void;
  /** The panel renders the tool switcher so it can disable it while a job runs. */
  renderToolSelector: (options: { disabled: boolean }) => ReactNode;
}

/** Text shown on the upload screen while this tool is selected. */
export interface UploadCopy {
  title: string;
  highlight: string;
  description: string;
  footnote: string;
}

/** What every feature exports from its `index.ts`. The page renders tools only through this. */
export interface ToolDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  upload: UploadCopy;
  Panel: ComponentType<ToolPanelProps>;
}
