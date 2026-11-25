// Shared helpers for this project's Claude Code hooks.
import { spawnSync } from "node:child_process";
import path from "node:path";

// Claude Code can pass a lowercase drive letter (d:\...). Vitest run from such a cwd loads its
// runner twice and every test file crashes, so normalise to the canonical uppercase form.
export const projectDir = (
  process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
).replace(/^[a-z]:/, (drive) => drive.toUpperCase());

export async function readHookInput() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}

/** Runs a local CLI through node (no .cmd shims, works the same on Windows and Linux). */
export function runNodeCli(relativeBin, args) {
  const result = spawnSync(
    process.execPath,
    [path.join(projectDir, relativeBin), ...args],
    {
      cwd: projectDir,
      encoding: "utf8",
    },
  );
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

/** Project-relative path with forward slashes, or null when the file is outside the project. */
export function relativeToProject(filePath) {
  const relative = path.relative(
    projectDir,
    path.resolve(projectDir, filePath),
  );
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return relative.split(path.sep).join("/");
}
