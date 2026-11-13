"use server";

import { headers } from "next/headers";
import { parseEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message: string };

export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const raw = formData.get("email");
  const parsed = parseEmail(typeof raw === "string" ? raw : "");
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email: parsed.email,
    // Contas são criadas pela agência: não cria usuário novo por aqui.
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  // Resposta igual com ou sem cadastro, para não revelar quem tem conta.
  return { status: "sent", message: "Se o e-mail estiver cadastrado, enviamos um link de acesso." };
}
