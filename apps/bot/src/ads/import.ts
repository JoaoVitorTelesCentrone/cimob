import type postgres from "postgres";
import type { DailyInsight, MarketingApi } from "./marketing-api.ts";
import { importWindow } from "./window.ts";

/** Log da importação: conta de anúncios e números, nunca o token. */
export type ImportLog =
  | { level: "info"; event: "ad_spend_imported"; organizationId: string; rows: number }
  | {
      level: "warn";
      event: "ad_spend_failed";
      organizationId: string;
      adAccountId: string;
      status: number | null;
      code: number | null;
    };

type Account = {
  organization_id: string;
  org_name: string;
  ad_account_id: string;
  token: string | null;
};

/**
 * Importa o gasto por anúncio dos últimos 7 dias de cada imobiliária com conta de anúncios
 * (doc 06: a Meta ajusta os dias recentes, então a janela é regravada a cada rodada). Por
 * imobiliária é tudo ou nada: se uma conta falhar, nada dela é gravado e a operação é avisada;
 * as outras imobiliárias seguem. Token próprio vem do Vault; sem ele, o token do ambiente.
 */
export async function importAdSpend(deps: {
  sql: postgres.Sql;
  api: MarketingApi;
  fallbackToken: string | null;
  today?: Date;
  alert: (text: string) => Promise<void>;
  log: (entry: ImportLog) => void;
}): Promise<void> {
  const { since, until } = importWindow(deps.today ?? new Date());
  const accounts = await deps.sql<Account[]>`
    select a.organization_id, o.name as org_name, a.ad_account_id, s.decrypted_secret as token
    from meta_ads_accounts a
    join organizations o on o.id = a.organization_id
    left join vault.decrypted_secrets s on s.id = a.token_secret_id
    order by a.organization_id, a.ad_account_id`;

  const byOrg = new Map<string, Account[]>();
  for (const a of accounts) byOrg.set(a.organization_id, [...(byOrg.get(a.organization_id) ?? []), a]);

  for (const [organizationId, own] of byOrg) {
    const rows = await fetchAll(deps, own, since, until);
    if (!rows) continue;
    await deps.sql.begin(async (tx) => {
      await tx`delete from ad_spend_daily
               where organization_id = ${organizationId} and date between ${since} and ${until}`;
      for (const r of rows) {
        await tx`
          insert into ad_spend_daily
            (organization_id, date, ad_id, campaign_id, spend, impressions, clicks)
          values (${organizationId}, ${r.date}, ${r.adId}, ${r.campaignId}, ${r.spend},
                  ${r.impressions}, ${r.clicks})
          on conflict (organization_id, date, ad_id) do update
            set campaign_id = excluded.campaign_id, spend = excluded.spend,
                impressions = excluded.impressions, clicks = excluded.clicks`;
      }
    });
    deps.log({ level: "info", event: "ad_spend_imported", organizationId, rows: rows.length });
  }
}

/** Gasto de todas as contas da imobiliária na janela; nulo se alguma falhar (já avisado). */
async function fetchAll(
  deps: Parameters<typeof importAdSpend>[0],
  accounts: Account[],
  since: string,
  until: string,
): Promise<DailyInsight[] | null> {
  const rows: DailyInsight[] = [];
  for (const a of accounts) {
    const token = a.token ?? deps.fallbackToken;
    const fail = async (detail: string, status: number | null, code: number | null) => {
      deps.log({
        level: "warn",
        event: "ad_spend_failed",
        organizationId: a.organization_id,
        adAccountId: a.ad_account_id,
        status,
        code,
      });
      await deps.alert(
        `Falha na importação de gasto da Meta (${a.org_name}, ${a.ad_account_id}): ${detail}`,
      );
    };
    if (!token) {
      await fail("sem token da Marketing API", null, null);
      return null;
    }
    const result = await deps.api.dailyInsights({
      adAccountId: a.ad_account_id,
      token,
      since,
      until,
    });
    if (!result.ok) {
      const code = result.code === null ? "" : ` código ${String(result.code)}`;
      await fail(`HTTP ${String(result.status)}${code}`, result.status, result.code);
      return null;
    }
    // A Meta só devolve o período pedido; o filtro garante que o delete cobre tudo o que entra.
    rows.push(...result.rows.filter((r) => r.date >= since && r.date <= until));
  }
  return rows;
}
