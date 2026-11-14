import { parseBusinessHours, type BusinessHours } from "@c1imob/core";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { TeamMember } from "@/lib/team";
import type { DashboardLead, SpendDay } from "./dashboard";
import { describeEvent } from "./history";
import type { LeadRow } from "./list";
import { STAGES } from "./stages";

const MAX_LEADS = 1000;

const date = z
  .string()
  .nullable()
  .transform((v) => (v ? new Date(v) : null));

const LeadRecord = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  phone: z.string(),
  stage: z.enum(STAGES),
  owner_id: z.uuid().nullable(),
  assigned_at: date,
  first_response_at: date,
  created_at: z.string().transform((v) => new Date(v)),
  next_step: z.string().nullable(),
  next_step_at: date,
});

const MemberRecord = z.object({
  user_id: z.uuid(),
  display_name: z.string().nullable(),
  role: z.enum(["agency_admin", "org_admin", "agent"]),
});

export type Member = { userId: string; name: string; role: z.infer<typeof MemberRecord>["role"] };

const LEAD_COLUMNS =
  "id, name, phone, stage, owner_id, assigned_at, first_response_at, created_at, next_step, next_step_at";

async function query<T>(
  run: (sb: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>,
  schema: z.ZodType<T>,
): Promise<T> {
  const result = await run(await createClient());
  if (result.error) throw new Error(result.error.message);
  return schema.parse(result.data);
}

/** Membros visíveis da organização (o RLS mostra a equipe ao gestor e só a si ao corretor). */
export async function loadMembers(organizationId: string): Promise<Member[]> {
  const rows = await query(
    (sb) =>
      sb
        .from("memberships")
        .select("user_id, display_name, role")
        .eq("organization_id", organizationId)
        .eq("active", true),
    z.array(MemberRecord),
  );
  return rows.map((r) => ({ userId: r.user_id, name: r.display_name ?? "Sem nome", role: r.role }));
}

function toRow(r: z.infer<typeof LeadRecord>, members: Member[]): LeadRow {
  return {
    id: r.id,
    name: r.name ?? "Sem nome",
    phone: r.phone,
    stage: r.stage,
    ownerId: r.owner_id,
    ownerName: members.find((m) => m.userId === r.owner_id)?.name ?? null,
    assignedAt: r.assigned_at,
    firstResponseAt: r.first_response_at,
    createdAt: r.created_at,
    nextStep: r.next_step,
    nextStepAt: r.next_step_at,
  };
}

/** Leads visíveis para o usuário (RLS: gestor vê todos; corretor, só os próprios). */
export async function loadLeads(organizationId: string, members: Member[]): Promise<LeadRow[]> {
  const rows = await query(
    (sb) =>
      sb
        .from("leads")
        .select(LEAD_COLUMNS)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(MAX_LEADS),
    z.array(LeadRecord),
  );
  return rows.map((r) => toRow(r, members));
}

const DashboardRecord = LeadRecord.extend({
  source: z.string().nullable(),
  qualified: z.boolean().nullable(),
});

/** Leads do painel: os mesmos da lista, com origem e qualificação. */
export async function loadDashboardLeads(
  organizationId: string,
  members: Member[],
): Promise<DashboardLead[]> {
  const rows = await query(
    (sb) =>
      sb
        .from("leads")
        .select(`${LEAD_COLUMNS}, source, qualified`)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(MAX_LEADS),
    z.array(DashboardRecord),
  );
  return rows.map((r) => ({ ...toRow(r, members), source: r.source, qualified: r.qualified }));
}

const SpendRecord = z.object({
  date: z.iso.date(),
  spend: z.union([z.string(), z.number()]).transform(Number),
});
const SPEND_PAGE = 1000;
const SPEND_DAYS = 31;

/**
 * Gasto da Meta dos últimos 31 dias (cobre o maior período do painel). O RLS só entrega ao
 * gestor; para o corretor vem vazio e o painel não fala de custo. A Meta agrega por dia no fuso
 * da conta; tratamos como dia de Brasília. Paginado: são linhas por anúncio e por dia.
 */
export async function loadAdSpend(organizationId: string, now = new Date()): Promise<SpendDay[]> {
  const since = new Date(now.getTime() - SPEND_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const days: SpendDay[] = [];
  for (let from = 0; ; from += SPEND_PAGE) {
    const page = await query(
      (sb) =>
        sb
          .from("ad_spend_daily")
          .select("date, spend")
          .eq("organization_id", organizationId)
          .gte("date", since)
          .order("date")
          .order("ad_id")
          .range(from, from + SPEND_PAGE - 1),
      z.array(SpendRecord),
    );
    for (const r of page) days.push({ date: new Date(`${r.date}T00:00:00-03:00`), spend: r.spend });
    if (page.length < SPEND_PAGE) return days;
  }
}

/** Gasto da Meta por dia entre duas datas ("AAAA-MM-DD", fim exclusivo), para o relatório mensal. */
export async function loadSpendBetween(
  organizationId: string,
  from: string,
  to: string,
): Promise<{ date: string; spend: number }[]> {
  const days: { date: string; spend: number }[] = [];
  for (let offset = 0; ; offset += SPEND_PAGE) {
    const page = await query(
      (sb) =>
        sb
          .from("ad_spend_daily")
          .select("date, spend")
          .eq("organization_id", organizationId)
          .gte("date", from)
          .lt("date", to)
          .order("date")
          .order("ad_id")
          .range(offset, offset + SPEND_PAGE - 1),
      z.array(SpendRecord),
    );
    days.push(...page);
    if (page.length < SPEND_PAGE) return days;
  }
}

const DetailRecord = LeadRecord.extend({
  source: z.string().nullable(),
  intent: z.string().nullable(),
  budget_range: z.string().nullable(),
  timeframe: z.string().nullable(),
  wants_visit: z.boolean().nullable(),
  visit_at: date,
  lost_reason: z.string().nullable(),
  is_demo: z.boolean(),
  units: z.object({ code: z.string() }).nullable(),
});

const EventRecord = z.object({
  id: z.uuid(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()).catch({}),
  actor_id: z.uuid().nullable(),
  created_at: z.string().transform((v) => new Date(v)),
});

export type LeadDetail = LeadRow & {
  source: string | null;
  intent: string | null;
  budgetRange: string | null;
  timeframe: string | null;
  wantsVisit: boolean | null;
  visitAt: Date | null;
  lostReason: string | null;
  isDemo: boolean;
  unitCode: string | null;
  events: { id: string; title: string; detail: string | null; createdAt: Date }[];
};

export async function loadLead(
  organizationId: string,
  id: string,
  members: Member[],
): Promise<LeadDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const rows = await query(
    (sb) =>
      sb
        .from("leads")
        .select(
          `${LEAD_COLUMNS}, source, intent, budget_range, timeframe, wants_visit, visit_at, lost_reason, is_demo, units(code)`,
        )
        .eq("organization_id", organizationId)
        .eq("id", id)
        .limit(1),
    z.array(DetailRecord),
  );
  const [r] = rows;
  if (!r) return null;

  const events = await query(
    (sb) =>
      sb
        .from("lead_events")
        .select("id, type, data, actor_id, created_at")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    z.array(EventRecord),
  );

  return {
    ...toRow(r, members),
    source: r.source,
    intent: r.intent,
    budgetRange: r.budget_range,
    timeframe: r.timeframe,
    wantsVisit: r.wants_visit,
    visitAt: r.visit_at,
    lostReason: r.lost_reason,
    isDemo: r.is_demo,
    unitCode: r.units?.code ?? null,
    events: events.map((e) => ({
      id: e.id,
      ...describeEvent(
        { type: e.type, data: e.data, actorId: e.actor_id },
        new Map(members.map((m) => [m.userId, m.name])),
      ),
      createdAt: e.created_at,
    })),
  };
}

const TeamRecord = MemberRecord.extend({
  in_rotation: z.boolean(),
  whatsapp: z.string().nullable(),
});

/** Equipe ativa com o rodízio (o RLS mostra a equipe toda só ao gestor). */
export async function loadTeam(organizationId: string): Promise<TeamMember[]> {
  const rows = await query(
    (sb) =>
      sb
        .from("memberships")
        .select("user_id, display_name, role, in_rotation, whatsapp")
        .eq("organization_id", organizationId)
        .eq("active", true),
    z.array(TeamRecord),
  );
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.display_name ?? "Sem nome",
    role: r.role,
    inRotation: r.in_rotation,
    whatsapp: r.whatsapp,
  }));
}

/** Próximo da vez segundo o banco (nulo para quem não é gestor ou com o rodízio vazio). */
export async function loadNextInRotation(organizationId: string): Promise<string | null> {
  return query((sb) => sb.rpc("next_in_rotation", { org: organizationId }), z.uuid().nullable());
}

/** Papel do usuário logado na organização. */
export async function loadMyRole(organizationId: string): Promise<Member["role"] | null> {
  return query(
    (sb) => sb.rpc("role_in", { org: organizationId }),
    MemberRecord.shape.role.nullable(),
  );
}

/** Horário de atendimento da imobiliária (nulo = tempo corrido). */
export async function loadBusinessHours(organizationId: string): Promise<BusinessHours | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("business_hours")
    .eq("id", organizationId)
    .maybeSingle();
  return parseBusinessHours(data?.business_hours ?? null);
}
