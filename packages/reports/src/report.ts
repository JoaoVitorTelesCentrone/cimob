import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { monthRange, type ValueKind } from "./format.ts";

/** Dados de uma imobiliária, já filtrados pelo RLS de quem pede (o relatório não lê o banco). */
export type ReportInput = {
  leads: {
    id: string;
    source: string | null;
    stage: string;
    qualified: boolean | null;
    ownerName: string | null;
    assignedAt: Date | null;
    firstResponseAt: Date | null;
    createdAt: Date;
  }[];
  /** Gasto da Meta por dia ("AAAA-MM-DD"). */
  spend: { date: string; spend: number }[];
};

export type Metric = { label: string; value: number | null; previous: number | null; kind: ValueKind };
export type SourceRow = { source: string; leads: number; qualified: number; visits: number };
export type AgentRow = {
  name: string;
  leads: number;
  /** Mediana em minutos entre a atribuição e a 1ª resposta; nula sem resposta no mês. */
  firstResponseMedian: number | null;
  visits: number;
  /** 1ª resposta depois de 2 h, ou sem resposta há mais de 2 h. */
  lateResponses: number;
};
export type MonthlyReport = {
  month: string;
  label: string;
  previous: string;
  funnel: Metric[];
  /** Vazio quando não houve gasto no mês nem no anterior (o relatório não fala de custo). */
  cost: Metric[];
  bySource: SourceRow[];
  byAgent: AgentRow[];
};

const LATE_MS = 2 * 60 * 60 * 1000;
const SOURCE_LABEL = "CASE source WHEN 'meta_ads' THEN 'Anúncio Meta' WHEN 'site' THEN 'Site' ELSE coalesce(nullif(trim(source), ''), 'Sem origem') END";
/** Ordem do funil; perdido não "chegou" a nada (mesma regra do painel). */
const RANK = `CASE stage WHEN 'new' THEN 0 WHEN 'qualified' THEN 1 WHEN 'contacted' THEN 2
  WHEN 'visit_scheduled' THEN 3 WHEN 'visit_done' THEN 4 WHEN 'proposal' THEN 5 WHEN 'won' THEN 6 ELSE -1 END`;

async function load(conn: DuckDBConnection, input: ReportInput) {
  await conn.run(`CREATE TABLE leads (id VARCHAR, source VARCHAR, stage VARCHAR, qualified BOOLEAN,
    owner VARCHAR, assigned_ms BIGINT, first_ms BIGINT, created_ms BIGINT)`);
  await conn.run("CREATE TABLE spend (day VARCHAR, amount DOUBLE)");
  const leads = await conn.createAppender("leads");
  const ms = (d: Date | null) => {
    if (d) leads.appendBigInt(BigInt(d.getTime()));
    else leads.appendNull();
  };
  for (const l of input.leads) {
    leads.appendVarchar(l.id);
    if (l.source === null) leads.appendNull();
    else leads.appendVarchar(l.source);
    leads.appendVarchar(l.stage);
    if (l.qualified === null) leads.appendNull();
    else leads.appendBoolean(l.qualified);
    if (l.ownerName === null) leads.appendNull();
    else leads.appendVarchar(l.ownerName);
    ms(l.assignedAt);
    ms(l.firstResponseAt);
    ms(l.createdAt);
    leads.endRow();
  }
  leads.closeSync();
  const spend = await conn.createAppender("spend");
  for (const s of input.spend) {
    spend.appendVarchar(s.date);
    spend.appendDouble(s.spend);
    spend.endRow();
  }
  spend.closeSync();
  // Leads com as marcas do funil, para todas as consultas.
  await conn.run(`CREATE VIEW l AS SELECT *, ${RANK} AS rank,
    coalesce(qualified, false) OR (${RANK}) >= 1 AS is_qualified FROM leads`);
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function rows(conn: DuckDBConnection, sql: string, params: Record<string, unknown>) {
  const reader = await conn.runAndReadAll(sql, params as never);
  return reader.getRowObjects();
}

async function funnelOf(conn: DuckDBConnection, start: Date, end: Date) {
  const [r] = await rows(
    conn,
    `SELECT count(*) AS leads,
       count(*) FILTER (WHERE is_qualified) AS qualified,
       count(*) FILTER (WHERE rank >= 4) AS visits,
       count(*) FILTER (WHERE rank >= 5) AS proposals,
       count(*) FILTER (WHERE stage = 'won') AS won,
       count(*) FILTER (WHERE source = 'meta_ads') AS ad_leads,
       count(*) FILTER (WHERE source = 'meta_ads' AND rank >= 4) AS ad_visits
     FROM l WHERE created_ms >= $start AND created_ms < $end`,
    { start: BigInt(start.getTime()), end: BigInt(end.getTime()) },
  );
  return {
    leads: num(r?.["leads"]) ?? 0,
    qualified: num(r?.["qualified"]) ?? 0,
    visits: num(r?.["visits"]) ?? 0,
    proposals: num(r?.["proposals"]) ?? 0,
    won: num(r?.["won"]) ?? 0,
    adLeads: num(r?.["ad_leads"]) ?? 0,
    adVisits: num(r?.["ad_visits"]) ?? 0,
  };
}

async function spendOf(conn: DuckDBConnection, from: string, to: string) {
  const [r] = await rows(conn, "SELECT sum(amount) AS total FROM spend WHERE day >= $from AND day < $to", {
    from,
    to,
  });
  return num(r?.["total"]) ?? 0;
}

const per = (amount: number, count: number) => (count > 0 ? Math.round((amount / count) * 100) / 100 : null);

/**
 * Relatório mensal (T4.6) calculado em SQL num DuckDB em memória. Os leads contam pelo mês em que
 * chegaram (como no painel); o gasto, pelos dias do mês. `now` decide o que já está atrasado.
 */
export async function monthlyReport(input: ReportInput, month: string, now: Date): Promise<MonthlyReport> {
  const cur = monthRange(month);
  const prev = monthRange(cur.previous);
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  try {
    await load(conn, input);
    const [f, p] = await Promise.all([funnelOf(conn, cur.start, cur.end), funnelOf(conn, prev.start, prev.end)]);
    const [spent, spentBefore] = await Promise.all([
      spendOf(conn, cur.firstDay, cur.nextFirstDay),
      spendOf(conn, prev.firstDay, prev.nextFirstDay),
    ]);
    const count = (label: string, a: number, b: number): Metric => ({ label, value: a, previous: b, kind: "count" });
    const money = (label: string, a: number | null, b: number | null): Metric => ({
      label,
      value: a,
      previous: b,
      kind: "money",
    });

    const range = { start: BigInt(cur.start.getTime()), end: BigInt(cur.end.getTime()) };
    const sources = await rows(
      conn,
      `SELECT ${SOURCE_LABEL} AS label, count(*) AS leads,
         count(*) FILTER (WHERE is_qualified) AS qualified, count(*) FILTER (WHERE rank >= 4) AS visits
       FROM l WHERE created_ms >= $start AND created_ms < $end
       GROUP BY label ORDER BY (label = 'Sem origem'), leads DESC, label`,
      range,
    );
    const agents = await rows(
      conn,
      `SELECT owner AS name, count(*) AS leads,
         median((first_ms - assigned_ms) / 60000.0) FILTER (WHERE first_ms >= assigned_ms) AS median_min,
         count(*) FILTER (WHERE rank >= 4) AS visits,
         count(*) FILTER (WHERE assigned_ms IS NOT NULL AND (
           (first_ms IS NOT NULL AND first_ms - assigned_ms > $late) OR
           (first_ms IS NULL AND stage NOT IN ('won', 'lost') AND $now - assigned_ms > $late))) AS late
       FROM l WHERE owner IS NOT NULL AND created_ms >= $start AND created_ms < $end
       GROUP BY owner ORDER BY owner`,
      { ...range, late: BigInt(LATE_MS), now: BigInt(now.getTime()) },
    );

    return {
      month,
      label: cur.label,
      previous: cur.previous,
      funnel: [
        count("Leads", f.leads, p.leads),
        count("Qualificados", f.qualified, p.qualified),
        count("Visitas", f.visits, p.visits),
        count("Propostas", f.proposals, p.proposals),
        count("Ganhos", f.won, p.won),
      ],
      cost:
        spent > 0 || spentBefore > 0
          ? [
              money("Investimento", spent, spentBefore),
              money("CPL", per(spent, f.adLeads), per(spentBefore, p.adLeads)),
              money("Custo por visita", per(spent, f.adVisits), per(spentBefore, p.adVisits)),
            ]
          : [],
      bySource: sources.map((r) => ({
        source: String(r["label"]),
        leads: num(r["leads"]) ?? 0,
        qualified: num(r["qualified"]) ?? 0,
        visits: num(r["visits"]) ?? 0,
      })),
      byAgent: agents.map((r) => ({
        name: String(r["name"]),
        leads: num(r["leads"]) ?? 0,
        firstResponseMedian: num(r["median_min"]),
        visits: num(r["visits"]) ?? 0,
        lateResponses: num(r["late"]) ?? 0,
      })),
    };
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
}
