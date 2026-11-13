import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { devAutoLogin, redirectFor } from "@/lib/access";
import { supabaseEnv } from "@/lib/supabase/env";
import { decideRoute, sanitizeHeaders } from "@/lib/tenant/route";
import { resolveTenant } from "@/lib/tenant/resolver";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // 1) Tenant: site público por subdomínio ou domínio próprio. CRM e login ignoram o endereço.
  const decision = await decideRoute({ host, pathname }, resolveTenant);
  if (decision.kind === "notFound") {
    return NextResponse.rewrite(new URL("/_tenant-not-found", request.url), { status: 404 });
  }
  if (decision.kind === "rewrite") {
    const headers = sanitizeHeaders(request.headers, decision.organizationId);
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // 2) Sessão: renova o login e protege /app. O cabeçalho interno nunca vem do cliente.
  const headers = sanitizeHeaders(request.headers, null);
  let response = NextResponse.next({ request: { headers } });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        headers.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers } });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const to = redirectFor(pathname, user !== null, {
    autoLogin: devAutoLogin(process.env) !== null,
  });
  if (to) {
    const redirect = NextResponse.redirect(new URL(to, request.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
