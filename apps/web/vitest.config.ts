import { defineConfig } from "vitest/config";

import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["**/*.test.{ts,tsx}", "tests/steps/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      include: ["lib/**", "components/**"],
      // lib/supabase/** e lib/org.ts são cola com Next/Supabase (cookies, RLS): cobertos por E2E e pelos testes de RLS em packages/db.
      exclude: [
        "**/*.test.*",
        "lib/supabase/**",
        "lib/org.ts",
        "lib/leads/queries.ts",
        "lib/inventory-queries.ts",
      ],
      thresholds: { lines: 70 },
    },
  },
});
