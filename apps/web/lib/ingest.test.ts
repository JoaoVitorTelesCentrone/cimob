import { describe, expect, it } from "vitest";
import { extractPdf } from "./ingest";

const pdf = new Blob(["%PDF-1.7 ..."], { type: "application/pdf" });
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const ROW = {
  code: "AUR-502",
  floor: 5,
  area_m2: 68.5,
  bedrooms: 2,
  parking: 1,
  price: 765000,
  status: "available",
  needs_review: false,
  issues: [],
};

function fake(response: () => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = (url, init) => {
    calls.push({ url: url instanceof Request ? url.url : url.toString(), init: init ?? {} });
    return response();
  };
  return { fetch, calls };
}

describe("extractPdf", () => {
  it("manda o PDF com a chave e o prefixo, e devolve as linhas validadas", async () => {
    const f = fake(() => json(200, { tables: 1, rows: [ROW], warnings: ["aviso"] }));
    const r = await extractPdf(pdf, "AUR-", { url: "http://ingest:8000", secret: "s3cr3t", fetch: f.fetch });
    expect(r).toEqual({ ok: true, rows: [ROW], warnings: ["aviso"] });
    expect(f.calls[0]?.url).toBe("http://ingest:8000/extract?prefix=AUR-");
    expect(new Headers(f.calls[0]?.init.headers).get("authorization")).toBe("Bearer s3cr3t");
  });

  it("traduz os erros do leitor para a pessoa", async () => {
    const msg = async (status: number, error: string) =>
      extractPdf(pdf, "", { url: "http://i", secret: "s", fetch: fake(() => json(status, { error })).fetch });
    expect(await msg(422, "no_table")).toEqual({
      ok: false,
      message: "Não achei a tabela de preços nesse PDF. Se for uma imagem escaneada, peça o PDF original à incorporadora.",
    });
    expect(await msg(415, "not_pdf")).toEqual({ ok: false, message: "O arquivo não é um PDF." });
    expect(await msg(413, "too_large")).toEqual({ ok: false, message: "O PDF passa de 20 MB." });
    expect(await msg(422, "unreadable_pdf")).toEqual({ ok: false, message: "Não consegui abrir esse PDF." });
  });

  it("leitor fora do ar ou sem configuração", async () => {
    const down = fake(() => Promise.reject(new Error("ECONNREFUSED")));
    expect(await extractPdf(pdf, "", { url: "http://i", secret: "s", fetch: down.fetch })).toEqual({
      ok: false,
      message: "O leitor de PDF está fora do ar. Tente de novo em alguns minutos.",
    });
    expect(await extractPdf(pdf, "", { url: "", secret: "", fetch: down.fetch })).toEqual({
      ok: false,
      message: "O leitor de PDF não está configurado (INGEST_URL e INGEST_SECRET).",
    });
  });

  it("resposta fora do formato não vira rascunho", async () => {
    const f = fake(() => json(200, { rows: [{ code: 1 }] }));
    expect(await extractPdf(pdf, "", { url: "http://i", secret: "s", fetch: f.fetch })).toMatchObject({ ok: false });
  });
});
