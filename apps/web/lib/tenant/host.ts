export type HostKind =
  { kind: "platform" } | { kind: "subdomain"; slug: string } | { kind: "custom"; domain: string };

export const DEFAULT_ROOT_DOMAINS = ["c1imob.com.br", "localhost"];

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Classifica o `Host` da requisição: plataforma, subdomínio de uma imobiliária ou domínio próprio. */
export function parseHost(rawHost: string, rootDomains: string[] = DEFAULT_ROOT_DOMAINS): HostKind {
  const host = (rawHost.split(":")[0] ?? "").trim().toLowerCase();
  if (IPV4.test(host)) return { kind: "platform" };

  for (const root of rootDomains) {
    if (host === root || host === `www.${root}`) return { kind: "platform" };
    if (host.endsWith(`.${root}`)) {
      return { kind: "subdomain", slug: host.slice(0, -(root.length + 1)) };
    }
  }
  return { kind: "custom", domain: host };
}
