export type OrgOption = { id: string; name: string };

export type Decision =
  | { kind: "enter"; organization: OrgOption }
  | { kind: "choose"; options: OrgOption[] }
  | { kind: "none"; message: string };

export function decideOrganization(orgs: OrgOption[], preferredId: string | null): Decision {
  const [first] = orgs;
  if (!first) return { kind: "none", message: "Você ainda não tem acesso a nenhuma imobiliária" };
  if (orgs.length === 1) return { kind: "enter", organization: first };
  const preferred = orgs.find((o) => o.id === preferredId);
  return preferred ? { kind: "enter", organization: preferred } : { kind: "choose", options: orgs };
}
