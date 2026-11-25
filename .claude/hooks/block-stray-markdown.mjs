// PreToolUse (Write): refuse to create new Markdown files outside docs/. Agents tend to leave
// summary/notes .md files behind; editing existing ones (README, CLAUDE.md) stays allowed.
import { existsSync } from "node:fs";
import path from "node:path";
import { projectDir, readHookInput, relativeToProject } from "./lib.mjs";

const input = await readHookInput();
const file = relativeToProject(input.tool_input?.file_path ?? "");

const ALLOWED_NEW_FILES = new Set(["CLAUDE.md"]);

if (
  !file ||
  !file.endsWith(".md") ||
  file.startsWith("docs/") ||
  ALLOWED_NEW_FILES.has(file)
) {
  process.exit(0);
}

if (existsSync(path.join(projectDir, file))) {
  process.exit(0);
}

console.error(
  `Blocked: creating ${file}. New Markdown belongs in docs/ (decisions go in docs/decisions/). ` +
    "Report results in the conversation instead of writing a summary file.",
);
process.exit(2);
