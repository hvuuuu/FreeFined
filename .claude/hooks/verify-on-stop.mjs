// Stop: before Claude finishes a turn that changed TypeScript, run the type checks and unit
// tests. On failure, block the stop so Claude fixes the code instead of reporting "done".
import { spawnSync } from "node:child_process";
import { projectDir, readHookInput, runNodeCli } from "./lib.mjs";

const input = await readHookInput();

// Already continuing because of this hook: do not loop forever.
if (input.stop_hook_active) {
  process.exit(0);
}

const status = spawnSync("git", ["status", "--porcelain"], {
  cwd: projectDir,
  encoding: "utf8",
});
const touchedTypeScript = (status.stdout ?? "")
  .split("\n")
  .some((line) => /\.(ts|tsx|mts|json)$/.test(line.trim()));
if (!touchedTypeScript) {
  process.exit(0);
}

const checks = [
  [
    "types (main)",
    "node_modules/typescript/bin/tsc",
    ["--noEmit", "-p", "tsconfig.json"],
  ],
  [
    "types (workers)",
    "node_modules/typescript/bin/tsc",
    ["--noEmit", "-p", "tsconfig.worker.json"],
  ],
  ["unit tests", "node_modules/vitest/vitest.mjs", ["run"]],
];

for (const [name, bin, args] of checks) {
  const result = runNodeCli(bin, args);
  if (!result.ok) {
    const tail = result.output.split("\n").slice(-60).join("\n");
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `${name} failed. Fix this before finishing:\n${tail}`,
      }),
    );
    process.exit(0);
  }
}
