import type { ToolDefinition } from "@/shared/tools/tool-definition";
import { Wand2 } from "lucide-react";
import { EnhancePanel } from "./enhance-panel";

export const enhanceTool = {
  id: "enhance",
  label: "Enhance",
  icon: Wand2,
  upload: {
    title: "FreeFined AI image enhancer for ",
    highlight: "one-click upscaling",
    description:
      "Upscale, denoise, and sharpen JPG, PNG, WEBP, AVIF, and HEIC photos in seconds. No account, no limits.",
    footnote:
      "FreeFined runs enhancement work in your browser with WebGPU, WebGL, or WASM when available, then lets you compare and download the result.",
  },
  Panel: EnhancePanel,
} satisfies ToolDefinition;
