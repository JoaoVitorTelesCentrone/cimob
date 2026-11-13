import { execSync } from "node:child_process";

/**
 * Chaves do Supabase local para o E2E. Vêm do ambiente (CI) ou de `supabase status` (máquina local).
 * A chave secreta fica só no processo de teste: o app recebe apenas a URL e a chave publicável.
 */
export function loadSupabaseEnv(): void {
  if (process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
  let output: string;
  try {
    output = execSync("npx --yes supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("Supabase local fora do ar. Rode `pnpm db:start` antes do `pnpm test:e2e`.");
  }
  const read = (name: string) => {
    const match = new RegExp(`^${name}="?([^"\\n]*)"?$`, "m").exec(output);
    if (!match?.[1]) throw new Error(`\`supabase status\` não trouxe ${name}.`);
    return match[1];
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= read("API_URL");
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= read("PUBLISHABLE_KEY");
  process.env.SUPABASE_SECRET_KEY ??= read("SECRET_KEY");
}
