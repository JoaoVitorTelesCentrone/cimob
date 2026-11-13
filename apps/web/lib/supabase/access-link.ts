import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Manda o link de acesso a quem foi convidado (cria a conta no Auth se preciso). Cliente sem sessão
 * e sem PKCE: o link é aberto no navegador do convidado, não no de quem convidou. Por isso o
 * template de e-mail do Supabase aponta para /auth/confirm (token_hash), ver supabase/templates.
 */
export async function sendAccessLink(email: string, origin: string): Promise<boolean> {
  const { url, key } = supabaseEnv();
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" },
  });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm` },
  });
  return !error;
}
