import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES: readonly EmailOtpType[] = ["magiclink", "email"];

/** Link mágico com token_hash (template de e-mail do Supabase para SSR): valida e cria a sessão. */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");
  const type = TYPES.find((t) => t === rawType);
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      // Convites do e-mail da conta viram acesso na 1ª entrada (accept_my_invitations).
      await supabase.rpc("accept_my_invitations");
      return NextResponse.redirect(new URL("/app", request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?erro=link", request.url));
}
