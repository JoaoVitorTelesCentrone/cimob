const isApp = (path: string) => path === "/app" || path.startsWith("/app/");

/** Para onde mandar a pessoa, ou null se a requisição segue. */
export function redirectFor(
  pathname: string,
  signedIn: boolean,
  opts: { autoLogin?: boolean } = {},
): string | null {
  if (!signedIn && isApp(pathname)) return opts.autoLogin ? "/dev/entrar" : "/login";
  if (signedIn && pathname === "/login") return "/app";
  return null;
}

/**
 * Entrada automática no CRM com um usuário de demonstração, para ver o sistema sem link mágico.
 * Só existe em `next dev` e com e-mail e senha no `.env.local` (fora do git); em produção é nula.
 */
export function devAutoLogin(
  env: Record<string, string | undefined>,
): { email: string; password: string } | null {
  const email = env["DEV_AUTO_LOGIN_EMAIL"];
  const password = env["DEV_AUTO_LOGIN_PASSWORD"];
  if (env["NODE_ENV"] !== "development" || !email || !password) return null;
  return { email, password };
}
