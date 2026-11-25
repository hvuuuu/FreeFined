import { convertTool } from "@/features/convert";
import { enhanceTool } from "@/features/enhance";
import { removeBackgroundTool } from "@/features/remove-background";
import type { ToolDefinition } from "@/shared/tools/tool-definition";

/** Every tool on the home page, in switcher order. Adding a tool is one import and one entry. */
export const TOOLS = [
  enhanceTool,
  removeBackgroundTool,
  convertTool,
] as const satisfies readonly ToolDefinition[];

export type ToolId = (typeof TOOLS)[number]["id"];

export const DEFAULT_TOOL_ID: ToolId = "enhance";

export function findTool(id: ToolId): (typeof TOOLS)[number] {
  const tool = TOOLS.find((candidate) => candidate.id === id);
  if (!tool) {
    throw new Error(`Unknown tool: ${id}`);
  }
  return tool;
}
