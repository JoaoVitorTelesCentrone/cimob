import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
import { loadSupabaseEnv } from "./e2e/support/env";

// Chaves do Supabase local (ou do CI). Definidas aqui para o app (webServer) e para os workers herdarem.
loadSupabaseEnv();

const PORT = 3100;

const testDir = defineBddConfig({
  features: "features/**/*.feature",
  steps: "e2e/steps/**/*.ts",
  language: "pt",
  tags: "@e2e and not @wip",
  // Backlog de features ainda sem steps (T3+): pular o cenário em vez de falhar. Remover quando os steps existirem.
  missingSteps: "skip-scenario",
});

export default defineConfig({
  testDir,
  reporter: [["list"]],
  // Cenários com Realtime e duas pessoas: poucos workers para não disputar o banco local.
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${String(PORT)}`, trace: "on-first-retry" },
  webServer: {
    // Build de produção: é o que vai ao ar (Server Actions, Suspense, cache).
    command: `pnpm --filter @c1imob/web build && pnpm --filter @c1imob/web exec next start -p ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // Só o que o app precisa: nunca a chave secreta.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    },
  },
});
