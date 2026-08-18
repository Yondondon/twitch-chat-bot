// @ts-check
import js from "@eslint/js";

// Neither `typescript-eslint` nor `@typescript-eslint/parser` (currently
// 8.67.0) support TypeScript 7 yet — both throw on startup ("typescript-eslint
// does not support TS 7.0", see
// https://github.com/typescript-eslint/typescript-eslint/issues/10940), so
// there is currently no ESLint parser that can read this project's `.ts`
// files at all under TS7. Until upstream adds support, `.ts` sources are
// excluded from ESLint's scope here; `pnpm run build` (`tsc`) remains the
// authoritative syntax/type check for them in the meantime.
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "*.sqlite",
      "*.sqlite-journal",
      "**/*.ts",
    ],
  },
  js.configs.recommended,
];
