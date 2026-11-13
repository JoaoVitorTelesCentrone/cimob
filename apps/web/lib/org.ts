import { cookies } from "next/headers";
import { connection } from "next/server";
import { decideOrganization, type Decision, type OrgOption } from "./org-choice";
import { createClient } from "./supabase/server";

export const ORG_COOKIE = "c1_org";

/** Organizações em que o usuário logado é membro ativo (o RLS filtra). */
export async function myOrganizations(): Promise<OrgOption[]> {
  // Dados por usuário: sempre na hora da requisição (o client do Supabase usa Date.now()).
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id, name").order("name");
  return data ?? [];
}

export async function currentDecision(): Promise<Decision> {
  const [orgs, store] = await Promise.all([myOrganizations(), cookies()]);
  return decideOrganization(orgs, store.get(ORG_COOKIE)?.value ?? null);
}
