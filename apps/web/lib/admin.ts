import { connection } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Consultas de configuração e equipe. Client do usuário: o RLS decide o que cada um vê.
 * Sempre na hora da requisição (o client do Supabase usa Date.now(); ver lib/org.ts).
 */
async function sb() {
  await connection();
  return createClient();
}

/** Quem é da Center One (cria imobiliárias e cuida da parte técnica). */
export async function isPlatformAdmin(): Promise<boolean> {
  const result = await (await sb()).rpc("is_platform_admin");
  return !result.error && z.boolean().catch(false).parse(result.data);
}

const Settings = z.object({
  name: z.string(),
  slug: z.string(),
  brand: z.record(z.string(), z.unknown()),
  qualify_timeframe: z.string(),
  qualify_price_share: z.union([z.string(), z.number()]),
});
export type OrgSettings = z.infer<typeof Settings>;

export async function loadOrgSettings(organizationId: string): Promise<OrgSettings | null> {
  const { data } = await (await sb())
    .from("organizations")
    .select("name, slug, brand, qualify_timeframe, qualify_price_share")
    .eq("id", organizationId)
    .maybeSingle();
  const parsed = Settings.safeParse(data);
  return parsed.success ? parsed.data : null;
}

const Invitation = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(["agency_admin", "org_admin", "agent"]),
  display_name: z.string(),
  created_at: z.string(),
});
export type PendingInvitation = { id: string; email: string; name: string; role: string };

/** Convites ainda não aceitos (só o gestor vê). */
export async function loadPendingInvitations(organizationId: string): Promise<PendingInvitation[]> {
  const { data } = await (await sb())
    .from("invitations")
    .select("id, email, role, display_name, created_at")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  const parsed = z.array(Invitation).safeParse(data ?? []);
  if (!parsed.success) return [];
  return parsed.data.map((i) => ({ id: i.id, email: i.email, name: i.display_name, role: i.role }));
}

/** Pessoas desativadas da equipe (para reativar). */
export async function loadInactiveMembers(organizationId: string) {
  const { data } = await (await sb())
    .from("memberships")
    .select("user_id, display_name")
    .eq("organization_id", organizationId)
    .eq("active", false);
  const parsed = z
    .array(z.object({ user_id: z.uuid(), display_name: z.string().nullable() }))
    .safeParse(data ?? []);
  return parsed.success
    ? parsed.data.map((m) => ({ userId: m.user_id, name: m.display_name ?? "Sem nome" }))
    : [];
}

export type Technical = {
  phoneNumberId: string | null;
  whatsappToken: boolean;
  adAccountId: string | null;
  adsToken: boolean;
};

/** Parte técnica: o gestor vê o número e a conta e se há token guardado, nunca o token. */
export async function loadTechnical(organizationId: string): Promise<Technical> {
  const client = await sb();
  const [wa, ads] = await Promise.all([
    client
      .from("whatsapp_accounts")
      .select("phone_number_id, token_secret_id")
      .eq("organization_id", organizationId)
      .limit(1)
      .maybeSingle(),
    client
      .from("meta_ads_accounts")
      .select("ad_account_id, token_secret_id")
      .eq("organization_id", organizationId)
      .limit(1)
      .maybeSingle(),
  ]);
  const w = z
    .object({ phone_number_id: z.string(), token_secret_id: z.string().nullable() })
    .nullable()
    .catch(null)
    .parse(wa.data);
  const a = z
    .object({ ad_account_id: z.string(), token_secret_id: z.string().nullable() })
    .nullable()
    .catch(null)
    .parse(ads.data);
  return {
    phoneNumberId: w?.phone_number_id ?? null,
    whatsappToken: Boolean(w?.token_secret_id),
    adAccountId: a?.ad_account_id ?? null,
    adsToken: Boolean(a?.token_secret_id),
  };
}

/** Imobiliárias que a pessoa acessa, com o endereço (tela da agência). */
export async function loadMyOrganizationsWithSlug() {
  const { data } = await (await sb()).from("organizations").select("id, name, slug").order("name");
  const parsed = z.array(z.object({ id: z.uuid(), name: z.string(), slug: z.string() })).safeParse(data ?? []);
  return parsed.success ? parsed.data : [];
}
