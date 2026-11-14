import type { BusinessHours } from "@c1imob/core";
import { firstResponseMinutes } from "./first-response";
import { isLate, type LeadRow } from "./list";
import type { Member } from "./queries";
import { STAGES, type Stage } from "./stages";

export type DashboardLead = LeadRow & { source: string | null; qualified: boolean | null };

export const PERIODS = [7, 30] as const;
export type Period = (typeof PERIODS)[number];

export type Kpi = { label: string; value: string; detail: string };
export type FunnelStep = { label: string; count: number };
/** Colunas de custo: `null` sem gasto importado; "–" nas origens que não são anúncio. */
export type SourceRow = {
  source: string;
  leads: number;
  qualified: number;
  visits: number;
  investment: string | null;
  cpl: string | null;
  costPerVisit: string | null;
};
/** Gasto de um dia (início do dia no fuso da conta de anúncios). */
export type SpendDay = { date: Date; spend: number };
export type AgentRow = {
  name: string;
  leads: number;
  firstResponse: string;
  visits: number;
  proposals: number;
  late: number;
};
export type LateAlert = { count: number; message: string; href: string };

export type Dashboard = {
  period: Period;
  kpis: Kpi[];
  /** Vazio quando não há gasto importado no período (o painel não fala de custo). */
  costKpis: Kpi[];
  funnel: FunnelStep[];
  bySource: SourceRow[];
  byAgent: AgentRow[];
  lateAlert: LateAlert | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_SOURCE = "Sem origem";
const AD_SOURCE = "Anúncio Meta";
/** Origens gravadas pelo bot e pelo site. Origem desconhecida aparece como veio. */
const SOURCE_LABEL: Record<string, string> = { meta_ads: AD_SOURCE, site: "Site" };
const sourceLabel = (source: string | null) => {
  const value = source?.trim();
  return value ? (SOURCE_LABEL[value] ?? value) : NO_SOURCE;
};
const MAX_LATE_NAMES = 5;

/** Lê o período do endereço; só 7 ou 30 dias, padrão 30. */
export function parsePeriod(raw: string | string[] | undefined): Period {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return PERIODS.find((p) => String(p) === value) ?? 30;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export const formatMinutes = (minutes: number | null) =>
  minutes === null ? "–" : `${String(Math.round(minutes))} min`;

const brl = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatBRL = (value: number | null) =>
  value === null ? "–" : `R$ ${brl.format(value)}`;

export const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : 0;

const ORDER = Object.fromEntries(STAGES.map((s, i) => [s, i])) as Record<Stage, number>;

/** Chegou (ou passou) por `stage`. Perdido não passou por nada: não se sabe até onde foi. */
const reached = (lead: LeadRow, stage: Stage) =>
  lead.stage !== "lost" && ORDER[lead.stage] >= ORDER[stage];

/** Qualificado pelo bot ou movido adiante no funil pelo corretor. */
const isQualified = (lead: DashboardLead) => lead.qualified === true || reached(lead, "qualified");

const medianResponse = (leads: readonly LeadRow[]) =>
  median(leads.map(firstResponseMinutes).filter((m): m is number => m !== null));

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
const byText = (a: string, b: string) => fold(a).localeCompare(fold(b), "pt-BR");

function kpis(leads: DashboardLead[]): Kpi[] {
  const qualified = leads.filter(isQualified).length;
  const visits = leads.filter((l) => reached(l, "visit_done")).length;
  return [
    { label: "Leads", value: String(leads.length), detail: "no período" },
    {
      label: "Qualificados",
      value: String(qualified),
      detail: `${String(percent(qualified, leads.length))}% dos leads`,
    },
    {
      label: "1ª resposta (mediana)",
      value: formatMinutes(medianResponse(leads)),
      detail: "após atribuição",
    },
    {
      label: "Visitas feitas",
      value: String(visits),
      detail: `${String(percent(visits, qualified))}% dos qualificados`,
    },
    {
      label: "Propostas",
      value: String(leads.filter((l) => reached(l, "proposal")).length),
      detail: "em andamento ou fechadas",
    },
    {
      label: "Negócios ganhos",
      value: String(leads.filter((l) => l.stage === "won").length),
      detail: "registrados pelo corretor",
    },
  ];
}

function funnel(leads: DashboardLead[]): FunnelStep[] {
  const count = (stage: Stage) => leads.filter((l) => reached(l, stage)).length;
  return [
    { label: "Leads", count: leads.length },
    { label: "Qualificados", count: leads.filter(isQualified).length },
    { label: "Em atendimento+", count: count("contacted") },
    { label: "Visita agendada+", count: count("visit_scheduled") },
    { label: "Visita feita+", count: count("visit_done") },
    { label: "Proposta+", count: count("proposal") },
    { label: "Ganho", count: leads.filter((l) => l.stage === "won").length },
  ];
}

/** Custo por unidade (lead, visita); sem unidade não há custo. */
const costPer = (spend: number, count: number) => (count ? spend / count : null);
const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

type Cost = { investment: number; leads: number; visits: number };

/** Gasto e resultados dos anúncios no período; nulo sem gasto importado. */
function adCost(leads: DashboardLead[], spend: readonly SpendDay[]): Cost | null {
  if (spend.length === 0) return null;
  const ads = leads.filter((l) => sourceLabel(l.source) === AD_SOURCE);
  return {
    investment: spend.reduce((sum, d) => sum + d.spend, 0),
    leads: ads.length,
    visits: ads.filter((l) => reached(l, "visit_done")).length,
  };
}

function costKpis(cost: Cost | null): Kpi[] {
  if (!cost) return [];
  return [
    { label: "Investimento", value: formatBRL(cost.investment), detail: "em anúncios Meta" },
    {
      label: "CPL",
      value: formatBRL(costPer(cost.investment, cost.leads)),
      detail: plural(cost.leads, "lead de anúncio", "leads de anúncio"),
    },
    {
      label: "Custo por visita",
      value: formatBRL(costPer(cost.investment, cost.visits)),
      detail: plural(cost.visits, "visita de anúncio", "visitas de anúncio"),
    },
  ];
}

function sourceCost(source: string, cost: Cost | null) {
  if (!cost) return { investment: null, cpl: null, costPerVisit: null };
  if (source !== AD_SOURCE) return { investment: "–", cpl: "–", costPerVisit: "–" };
  return {
    investment: formatBRL(cost.investment),
    cpl: formatBRL(costPer(cost.investment, cost.leads)),
    costPerVisit: formatBRL(costPer(cost.investment, cost.visits)),
  };
}

function bySource(leads: DashboardLead[], cost: Cost | null): SourceRow[] {
  const groups = Map.groupBy(leads, (l) => sourceLabel(l.source));
  return [...groups]
    .map(([source, group]) => ({
      source,
      leads: group.length,
      qualified: group.filter(isQualified).length,
      visits: group.filter((l) => reached(l, "visit_done")).length,
      ...sourceCost(source, cost),
    }))
    .sort((a, b) => {
      if ((a.source === NO_SOURCE) !== (b.source === NO_SOURCE))
        return a.source === NO_SOURCE ? 1 : -1;
      return b.leads - a.leads || byText(a.source, b.source);
    });
}

/** Desempenho de um membro: leads do período e atrasados de agora (o atraso não depende do período). */
export function agentStats(
  member: Member,
  inPeriod: readonly DashboardLead[],
  all: readonly DashboardLead[],
  now: Date,
  hours: BusinessHours | null = null,
): AgentRow {
  const mine = inPeriod.filter((l) => l.ownerId === member.userId);
  return {
    name: member.name,
    leads: mine.length,
    firstResponse: formatMinutes(medianResponse(mine)),
    visits: mine.filter((l) => reached(l, "visit_done")).length,
    proposals: mine.filter((l) => reached(l, "proposal")).length,
    late: all.filter((l) => l.ownerId === member.userId && isLate(l, now, hours)).length,
  };
}

/** Leads que chegaram nos últimos `period` dias. */
export function inPeriodOf<T extends LeadRow>(leads: readonly T[], period: Period, now: Date): T[] {
  const since = now.getTime() - period * DAY_MS;
  return leads.filter((l) => l.createdAt.getTime() >= since);
}

/** Dias de gasto que tocam o período: o dia em que o período começa entra inteiro. */
export function spendInPeriod(spend: readonly SpendDay[], period: Period, now: Date): SpendDay[] {
  const since = now.getTime() - period * DAY_MS;
  return spend.filter(
    (d) => d.date.getTime() + DAY_MS > since && d.date.getTime() <= now.getTime(),
  );
}

export const byName = (a: { name: string }, b: { name: string }) => byText(a.name, b.name);

/** Corretores ativos sempre aparecem; outros membros, só se tiverem lead no período ou atrasado. */
function byAgent(
  inPeriod: DashboardLead[],
  all: readonly DashboardLead[],
  members: readonly Member[],
  now: Date,
  hours: BusinessHours | null,
): AgentRow[] {
  return members
    .map((m) => ({ role: m.role, row: agentStats(m, inPeriod, all, now, hours) }))
    .filter(({ role, row }) => role === "agent" || row.leads > 0 || row.late > 0)
    .map(({ row }) => row)
    .sort(byName);
}

/** Alerta de atraso: considera todos os leads visíveis, não só os do período. */
export function lateAlert(
  leads: readonly LeadRow[],
  now: Date,
  hours: BusinessHours | null = null,
): LateAlert | null {
  const late = leads
    .filter((l) => isLate(l, now, hours))
    .sort((a, b) => (a.assignedAt?.getTime() ?? 0) - (b.assignedAt?.getTime() ?? 0));
  if (late.length === 0) return null;

  const head = late.length === 1 ? "1 lead" : `${String(late.length)} leads`;
  const names = late.slice(0, MAX_LATE_NAMES).map((l) => l.name);
  const rest = late.length - names.length;
  return {
    count: late.length,
    message: `${head} sem primeira resposta há mais de 2 h: ${names.join(", ")}${rest > 0 ? ` e mais ${String(rest)}` : ""}`,
    href: "/app/leads?late=1",
  };
}

export function buildDashboard(
  leads: readonly DashboardLead[],
  members: readonly Member[],
  period: Period,
  now: Date,
  spend: readonly SpendDay[] = [],
  hours: BusinessHours | null = null,
): Dashboard {
  const inPeriod = inPeriodOf(leads, period, now);
  const cost = adCost(inPeriod, spendInPeriod(spend, period, now));
  return {
    period,
    kpis: kpis(inPeriod),
    costKpis: costKpis(cost),
    funnel: funnel(inPeriod),
    bySource: bySource(inPeriod, cost),
    byAgent: byAgent(inPeriod, leads, members, now, hours),
    lateAlert: lateAlert(leads, now, hours),
  };
}
