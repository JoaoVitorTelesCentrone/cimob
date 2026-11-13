import { notFound } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { devAutoLogin } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

/**
 * Só em desenvolvimento: entra com o usuário de demonstração do `.env.local` e abre o CRM.
 * A sessão é de verdade (o RLS vale como para qualquer gestor). Em produção, 404.
 */
export async function GET(request: NextRequest) {
  const login = devAutoLogin(process.env);
  if (!login) notFound();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(login);
  if (error) {
    return new NextResponse(`Entrada automática falhou: ${error.message}. Rode pnpm db:seed:dev.`, {
      status: 500,
    });
  }
  return NextResponse.redirect(new URL("/app", request.url));
}
