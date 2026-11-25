import type { ToolDefinition } from "@/shared/tools/tool-definition";
import { RefreshCw } from "lucide-react";
import { ConvertPanel } from "./convert-panel";

export const convertTool = {
  id: "convert",
  label: "Convert",
  icon: RefreshCw,
  upload: {
    title: "FreeFined AI image converter for ",
    highlight: "any format conversion",
    description:
      "Convert JPG, PNG, WEBP, AVIF, and HEIC images to other formats client-side in seconds.",
    footnote:
      "FreeFined converts images in your browser with a background worker, so your files never leave your device.",
  },
  Panel: ConvertPanel,
} satisfies ToolDefinition;
