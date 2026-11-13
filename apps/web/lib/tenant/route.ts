import { parseHost } from "./host";

export type Tenant = { id: string; slug: string };
export type TenantKey = { kind: "slug" | "domain"; value: string };
export type Resolver<T extends Tenant = Tenant> = (key: TenantKey) => Promise<T | null>;

export type RouteDecision =
  | { kind: "pass" }
  | { kind: "notFound" }
  | { kind: "rewrite"; pathname: string; organizationId: string };

export const ORG_HEADER = "x-organization-id";

// Rotas que ignoram o endereço: o tenant vem da sessão (CRM) ou não existe (login, rotas internas).
const HOST_INDEPENDENT = ["/app", "/login", "/auth", "/api"];
const isHostIndependent = (path: string) =>
  HOST_INDEPENDENT.some((p) => path === p || path.startsWith(`${p}/`));

export async function decideRoute(
  req: { host: string; pathname: string },
  resolve: Resolver,
  rootDomains?: string[],
): Promise<RouteDecision> {
  const host = parseHost(req.host, rootDomains);
  if (host.kind === "platform" || isHostIndependent(req.pathname)) return { kind: "pass" };

  const tenant = await resolve(
    host.kind === "subdomain"
      ? { kind: "slug", value: host.slug }
      : { kind: "domain", value: host.domain },
  );
  if (!tenant) return { kind: "notFound" };

  const rest = req.pathname === "/" ? "" : req.pathname;
  return { kind: "rewrite", pathname: `/${tenant.slug}${rest}`, organizationId: tenant.id };
}

/** Descarta o cabeçalho interno vindo do cliente e define o da organização resolvida, se houver. */
export function sanitizeHeaders(incoming: Headers, organizationId: string | null): Headers {
  const headers = new Headers(incoming);
  headers.delete(ORG_HEADER);
  if (organizationId) headers.set(ORG_HEADER, organizationId);
  return headers;
}
