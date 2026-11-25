import type { ToolDefinition } from "@/shared/tools/tool-definition";
import { Scissors } from "lucide-react";
import { RemoveBackgroundPanel } from "./remove-background-panel";

export const removeBackgroundTool = {
  id: "remove-background",
  label: "Remove BG",
  icon: Scissors,
  upload: {
    title: "FreeFined AI background remover for ",
    highlight: "transparent images",
    description:
      "Cut out the main subject from JPG, PNG, WEBP, AVIF, and HEIC images in your browser. No account, no watermark.",
    footnote:
      "FreeFined runs background removal in your browser with WebGPU or WASM when available, then lets you download a transparent image.",
  },
  Panel: RemoveBackgroundPanel,
} satisfies ToolDefinition;
