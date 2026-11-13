import { defineConfig } from "vitest/config";

export default defineConfig({
  // O tsconfig preserva o JSX (para o Next); nos testes ele precisa virar chamada de função.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/steps/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Os componentes .tsx (Canvas/WebGL) são conferidos no navegador (E2E); a lógica fica em .ts.
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: { lines: 90 },
    },
  },
});
