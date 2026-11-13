import { describe, expect, it } from "vitest";
import { createMarketingApi } from "./marketing-api.ts";

type Captured = { url: URL; init: RequestInit };

function fakeFetch(responses: (() => Promise<Response>)[]) {
  const seen: Captured[] = [];
  const fetch: typeof globalThis.fetch = (url, init) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    seen.push({ url: new URL(href), init: init ?? {} });
    const next = responses[seen.length - 1];
    return next ? next() : Promise.reject(new Error("chamada a mais"));
  };
  return { fetch, seen };
}
const json = (status: number, body: unknown) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const opts = { adAccountId: "act_111", token: "EAAG-segredo-longo", since: "2026-11-06", until: "2026-11-12" };

describe("createMarketingApi", () => {
  it("pede o insights por anúncio e por dia no período, com o token no cabeçalho", async () => {
    const { fetch, seen } = fakeFetch([json(200, { data: [] })]);
    await createMarketingApi({ version: "v26.0", fetch }).dailyInsights(opts);

    const url = seen[0]?.url;
    expect(`${url?.origin ?? ""}${url?.pathname ?? ""}`).toBe(
      "https://graph.facebook.com/v26.0/act_111/insights",
    );
    expect(url?.searchParams.get("level")).toBe("ad");
    expect(url?.searchParams.get("time_increment")).toBe("1");
    expect(JSON.parse(url?.searchParams.get("time_range") ?? "null")).toEqual({
      since: "2026-11-06",
      until: "2026-11-12",
    });
    expect(url?.searchParams.get("fields")).toBe("ad_id,campaign_id,spend,impressions,clicks");
    expect(url?.href).not.toContain("EAAG");
    expect(new Headers(seen[0]?.init.headers).get("authorization")).toBe("Bearer EAAG-segredo-longo");
  });

  it("aceita o id da conta sem o prefixo act_", async () => {
    const { fetch, seen } = fakeFetch([json(200, { data: [] })]);
    await createMarketingApi({ version: "v26.0", fetch }).dailyInsights({ ...opts, adAccountId: "111" });
    expect(seen[0]?.url.pathname).toBe("/v26.0/act_111/insights");
  });

  it("converte os números (a Meta manda texto) e segue a paginação", async () => {
    const { fetch, seen } = fakeFetch([
      json(200, {
        data: [
          { date_start: "2026-11-12", ad_id: "ad_1", campaign_id: "camp_9", spend: "120.50", impressions: "4000", clicks: "55" },
        ],
        paging: { next: "https://graph.facebook.com/v26.0/act_111/insights?after=XYZ" },
      }),
      json(200, { data: [{ date_start: "2026-11-11", ad_id: "ad_2", spend: "30", impressions: "900" }] }),
    ]);
    const result = await createMarketingApi({ version: "v26.0", fetch }).dailyInsights(opts);

    expect(result).toEqual({
      ok: true,
      rows: [
        { date: "2026-11-12", adId: "ad_1", campaignId: "camp_9", spend: 120.5, impressions: 4000, clicks: 55 },
        { date: "2026-11-11", adId: "ad_2", campaignId: null, spend: 30, impressions: 900, clicks: 0 },
      ],
    });
    expect(seen[1]?.url.searchParams.get("after")).toBe("XYZ");
    expect(new Headers(seen[1]?.init.headers).get("authorization")).toBe("Bearer EAAG-segredo-longo");
  });

  it("não segue paginação para fora da Graph API configurada", async () => {
    const { fetch, seen } = fakeFetch([
      json(200, { data: [], paging: { next: "https://evil.example/steal" } }),
    ]);
    const result = await createMarketingApi({ version: "v26.0", fetch }).dailyInsights(opts);
    expect(result.ok).toBe(false);
    expect(seen).toHaveLength(1);
  });

  it("devolve status, código e mensagem do erro, sem o token", async () => {
    const { fetch } = fakeFetch([
      json(400, { error: { code: 190, message: "Invalid token EAAG-segredo-longo" } }),
    ]);
    const result = await createMarketingApi({ version: "v26.0", fetch }).dailyInsights(opts);
    expect(result).toEqual({ ok: false, status: 400, code: 190, message: "Invalid token ***" });
  });

  it("falha de rede vira status 0", async () => {
    const { fetch } = fakeFetch([() => Promise.reject(new Error("ECONNRESET"))]);
    const result = await createMarketingApi({ version: "v26.0", fetch }).dailyInsights(opts);
    expect(result).toEqual({ ok: false, status: 0, code: null, message: "ECONNRESET" });
  });

  it("resposta fora do formato é erro, não gasto zerado", async () => {
    const { fetch } = fakeFetch([json(200, { data: [{ ad_id: "ad_1" }] })]);
    const result = await createMarketingApi({ version: "v26.0", fetch }).dailyInsights(opts);
    expect(result.ok).toBe(false);
  });
});
