# 0001 — Toolchain

- **Context:** Solo portfolio/learning project on Next.js 16. Nothing checked types or lint before deploy (`next build` no longer lints; `ignoreBuildErrors` was on).
- **Decision:** Node 24 LTS, pnpm, Prettier (+ tailwind plugin), ESLint 9 + eslint-config-next + typescript-eslint `strictTypeChecked`, TypeScript 6.0 with `strict` + `noUncheckedIndexedAccess`, Vitest (unit), Playwright (e2e), husky + lint-staged, GitHub Actions.
- **Why:** Mainstream choices with the best docs for learning; type-aware lint catches dropped promises around workers. TS 7 and ESLint 10 are blocked by typescript-eslint (`typescript <6.1`) and eslint-plugin-react (`eslint ^9.7`) peer ranges as of 2026-11.
- **Revisit when:** typescript-eslint supports TS 7, or eslint-config-next supports ESLint 10.
