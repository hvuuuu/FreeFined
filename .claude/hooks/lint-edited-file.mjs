// PostToolUse (Edit|Write): format the edited file, then lint TypeScript. Lint errors exit 2 so
// Claude sees them and fixes the file in the same turn, instead of leaving them for CI.
import { readHookInput, relativeToProject, runNodeCli } from "./lib.mjs";

const input = await readHookInput();
const file = relativeToProject(input.tool_input?.file_path ?? "");

if (!file || file.startsWith("node_modules/")) {
  process.exit(0);
}

// Formats any file Prettier understands (and skips ones .prettierignore lists).
runNodeCli("node_modules/prettier/bin/prettier.cjs", [
  "--write",
  "--ignore-unknown",
  file,
]);

if (!/\.(ts|tsx|mts)$/.test(file)) {
  process.exit(0);
}

const lint = runNodeCli("node_modules/eslint/bin/eslint.js", ["--fix", file]);
if (!lint.ok) {
  console.error(
    `ESLint found problems in ${file} (see docs/decisions/ for the architecture rules):\n${lint.output}`,
  );
  process.exit(2);
}
