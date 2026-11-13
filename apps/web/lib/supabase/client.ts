import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** Client do navegador com a sessão do usuário (cookies do @supabase/ssr). Só chave publicável. */
export function createBrowserSupabase() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
