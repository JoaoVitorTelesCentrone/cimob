import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Convites do e-mail da conta viram acesso na 1ª entrada (accept_my_invitations).
      await supabase.rpc("accept_my_invitations");
      return NextResponse.redirect(new URL("/app", request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?erro=link", request.url));
}
