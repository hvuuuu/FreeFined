import boundaries from "eslint-plugin-boundaries";
import nextConfig from "eslint-config-next";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: [
      ".next/**",
      "public/**",
      "next-env.d.ts",
      "test-results/**",
      "playwright-report/**",
    ],
  },

  ...nextConfig,

  // Type-aware rules: catch dropped promises (worker messages, canvas encoding), unsafe `any`
  // flowing through, and switches that miss a case of a union like JobState.
  {
    files: ["**/*.{ts,tsx,mts}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        // Workers are type-checked by their own tsconfig (no DOM), so list both projects.
        project: ["./tsconfig.json", "./tsconfig.worker.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: true },
      ],
      // `onClick={() => setValue(x)}` is idiomatic React; still flags returning void elsewhere.
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      // Numbers in UI strings ("Processing tile 3/12") are intended.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },

  // Architecture (docs/decisions/0002): app -> features -> shared, never backwards or sideways.
  {
    files: ["**/*.{ts,tsx,mts}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "app" },
        { type: "feature", pattern: "features/*", capture: ["featureName"] },
        { type: "shared", pattern: "shared/*" },
        { type: "components", pattern: "components" },
        { type: "lib", pattern: "lib" },
        { type: "scripts", pattern: "scripts" },
        { type: "e2e", pattern: "e2e" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "{{ from.element.types.[0] }} may not import {{ to.element.types.[0] }}. See docs/decisions/0002-feature-folders.md.",
          policies: [
            {
              // The page reaches a tool only through its public entry (index.ts exports the ToolDefinition).
              from: { element: { type: "app" } },
              allow: [
                {
                  to: {
                    element: { type: "feature", fileInternalPath: "index.ts" },
                  },
                },
                {
                  to: {
                    element: { type: ["app", "shared", "components", "lib"] },
                  },
                },
              ],
            },
            {
              // A feature uses shared code and shared UI; imports between features are disallowed by default.
              from: { element: { type: "feature" } },
              allow: {
                to: { element: { type: ["shared", "components", "lib"] } },
              },
            },
            {
              from: { element: { type: "components" } },
              allow: {
                to: { element: { type: ["components", "shared", "lib"] } },
              },
            },
            {
              // Shared code knows nothing about tools or UI, so any tool can depend on it.
              from: { element: { type: "shared" } },
              allow: { to: { element: { type: ["shared", "lib"] } } },
            },
            {
              from: { element: { type: "lib" } },
              allow: { to: { element: { type: "lib" } } },
            },
            {
              from: { element: { type: "scripts" } },
              allow: { to: { element: { type: "shared" } } },
            },
            {
              from: { element: { type: "e2e" } },
              allow: { to: { element: { type: "e2e" } } },
            },
          ],
        },
      ],
    },
  },

  // Worker code runs without a DOM or React. tsconfig.worker.json catches DOM globals;
  // this catches imports that would drag React or Next into the worker bundle.
  {
    files: [
      "**/*.worker.ts",
      "shared/worker-job/protocol.ts",
      "shared/worker-job/serve-jobs.ts",
      "shared/inference/**",
      "shared/image/**",
      "shared/models/**",
      "features/*/models.ts",
      "features/convert/formats.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react-dom",
                "react/*",
                "next",
                "next/*",
                "@/components/*",
                "lucide-react",
              ],
              message:
                "Worker-safe code must not import React, Next or UI modules.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["components/theme-toggle.tsx"],
    rules: {
      // next-themes needs a mounted flag set in an effect to avoid a hydration mismatch.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
