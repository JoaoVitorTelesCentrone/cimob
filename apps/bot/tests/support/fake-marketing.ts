import type {
  DailyInsight,
  MarketingApi,
  MarketingResult,
} from "../../src/ads/marketing-api.ts";

export type MarketingCall = {
  adAccountId: string;
  token: string;
  since: string;
  until: string;
};

/** Marketing API falsa: gasto por anúncio segue o roteiro do cenário; chamadas ficam registradas. */
export class FakeMarketing implements MarketingApi {
  readonly calls: MarketingCall[] = [];
  private readonly data = new Map<string, DailyInsight[]>();
  private readonly errors = new Map<string, Extract<MarketingResult, { ok: false }>>();

  /** O gasto que a Meta devolve para a conta; sem roteiro, responde vazio. */
  setInsights(adAccountId: string, rows: DailyInsight[]): void {
    this.data.set(adAccountId, rows);
  }

  scriptError(adAccountId: string, error: Extract<MarketingResult, { ok: false }>): void {
    this.errors.set(adAccountId, error);
  }

  dailyInsights(opts: {
    adAccountId: string;
    token: string;
    since: string;
    until: string;
  }): Promise<MarketingResult> {
    this.calls.push(opts);
    const error = this.errors.get(opts.adAccountId);
    if (error) return Promise.resolve(error);
    return Promise.resolve({ ok: true, rows: this.data.get(opts.adAccountId) ?? [] });
  }
}

export const MARKETING_ERRORS = {
  "erro interno": { ok: false, status: 500, code: 131000, message: "Something went wrong" },
} as const satisfies Record<string, Extract<MarketingResult, { ok: false }>>;
