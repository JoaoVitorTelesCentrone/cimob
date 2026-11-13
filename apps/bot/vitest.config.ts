import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/steps/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // server.ts e queue.ts são cola com Node e Redis (sobem processo e conexão); a lógica está nos outros arquivos.
      exclude: ["src/**/*.test.ts", "src/server.ts", "src/queue.ts", "src/workers/**"],
      thresholds: { lines: 90 },
    },
  },
});
