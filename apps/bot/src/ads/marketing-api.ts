import { z } from "zod";

/** Gasto de um anúncio num dia, como a Marketing API agrega (fuso da conta de anúncios). */
export type DailyInsight = {
  date: string;
  adId: string;
  campaignId: string | null;
  spend: number;
  impressions: number;
  clicks: number;
};

/** Resultado da consulta. Nunca carrega o token. */
export type MarketingResult =
  | { ok: true; rows: DailyInsight[] }
  | { ok: false; status: number; code: number | null; message: string };

export type MarketingApi = {
  dailyInsights(opts: {
    adAccountId: string;
    token: string;
    since: string;
    until: string;
  }): Promise<MarketingResult>;
};

const TIMEOUT_MS = 15_000;
/** Limite de páginas por conta: 500 linhas por página cobre centenas de anúncios em 7 dias. */
const MAX_PAGES = 50;
const FIELDS = "ad_id,campaign_id,spend,impressions,clicks";

const count = z
  .string()
  .regex(/^\d+$/)
  .optional()
  .transform((v) => (v ? Number(v) : 0));
const Row = z.object({
  date_start: z.iso.date(),
  ad_id: z.string().min(1),
  campaign_id: z.string().optional(),
  spend: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number),
  impressions: count,
  clicks: count,
});
const Page = z.object({
  data: z.array(Row),
  paging: z.object({ next: z.string().optional() }).optional(),
});
const ErrorBody = z.object({
  error: z.object({ code: z.number().optional(), message: z.string().optional() }),
});

const redact = (text: string, secret: string) =>
  secret.length >= 8 ? text.split(secret).join("***") : text;

/**
 * Cliente da Marketing API: GET /{versão}/act_{id}/insights por anúncio e por dia. O token vai
 * no cabeçalho (nunca na URL, que pode parar em log de proxy). A paginação só segue links da
 * própria Graph API configurada, para o token não ir a outro host.
 */
export function createMarketingApi(opts: {
  version: string;
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
}): MarketingApi {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const base = opts.baseUrl ?? "https://graph.facebook.com";
  const origin = new URL(base).origin;

  return {
    async dailyInsights({ adAccountId, token, since, until }) {
      const account = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
      const first = new URL(`${base}/${opts.version}/${encodeURIComponent(account)}/insights`);
      first.search = new URLSearchParams({
        level: "ad",
        time_increment: "1",
        time_range: JSON.stringify({ since, until }),
        fields: FIELDS,
        limit: "500",
      }).toString();

      const rows: DailyInsight[] = [];
      let next: string | undefined = first.href;
      for (let page = 0; next; page++) {
        if (page >= MAX_PAGES || new URL(next).origin !== origin) {
          return { ok: false, status: 0, code: null, message: "paginação inesperada da Meta" };
        }
        let res: Response;
        try {
          res = await doFetch(next, {
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return { ok: false, status: 0, code: null, message: redact(message, token) };
        }
        const body: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const err = ErrorBody.safeParse(body);
          return {
            ok: false,
            status: res.status,
            code: err.success ? (err.data.error.code ?? null) : null,
            message: redact(
              (err.success ? err.data.error.message : undefined) ?? `HTTP ${String(res.status)}`,
              token,
            ),
          };
        }
        const parsed = Page.safeParse(body);
        if (!parsed.success) {
          return { ok: false, status: res.status, code: null, message: "resposta fora do formato" };
        }
        for (const r of parsed.data.data) {
          rows.push({
            date: r.date_start,
            adId: r.ad_id,
            campaignId: r.campaign_id ?? null,
            spend: r.spend,
            impressions: r.impressions,
            clicks: r.clicks,
          });
        }
        next = parsed.data.paging?.next;
      }
      return { ok: true, rows };
    },
  };
}
