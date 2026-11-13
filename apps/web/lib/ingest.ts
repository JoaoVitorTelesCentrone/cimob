import { z } from "zod";

/** Linha como o services/ingest devolve (e como create_unit_import grava). */
const Row = z.object({
  code: z.string().min(1),
  floor: z.number().int().nullable(),
  area_m2: z.number().nullable(),
  bedrooms: z.number().int().nullable(),
  parking: z.number().int().nullable(),
  price: z.number().nullable(),
  status: z.enum(["available", "reserved", "sold"]).nullable(),
  needs_review: z.boolean(),
  issues: z.array(z.string()),
});
const Result = z.object({ tables: z.number(), rows: z.array(Row), warnings: z.array(z.string()) });
export type ExtractedRow = z.infer<typeof Row>;

export type Extracted =
  | { ok: true; rows: ExtractedRow[]; warnings: string[] }
  | { ok: false; message: string };

const ERRORS: Record<string, string> = {
  no_table:
    "Não achei a tabela de preços nesse PDF. Se for uma imagem escaneada, peça o PDF original à incorporadora.",
  not_pdf: "O arquivo não é um PDF.",
  too_large: "O PDF passa de 20 MB.",
  unreadable_pdf: "Não consegui abrir esse PDF.",
};
const DOWN = "O leitor de PDF está fora do ar. Tente de novo em alguns minutos.";
const TIMEOUT_MS = 120_000;

/** Manda o PDF ao services/ingest (só no servidor: a chave nunca vai ao navegador). */
export async function extractPdf(
  file: Blob,
  prefix: string,
  opts: { url: string; secret: string; fetch?: typeof globalThis.fetch },
): Promise<Extracted> {
  if (!opts.url || !opts.secret) {
    return { ok: false, message: "O leitor de PDF não está configurado (INGEST_URL e INGEST_SECRET)." };
  }
  let res: Response;
  try {
    res = await (opts.fetch ?? globalThis.fetch)(
      `${opts.url.replace(/\/+$/, "")}/extract?prefix=${encodeURIComponent(prefix)}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${opts.secret}`, "content-type": "application/pdf" },
        body: file,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch {
    return { ok: false, message: DOWN };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const code = z.object({ error: z.string() }).safeParse(body);
    return { ok: false, message: (code.success && ERRORS[code.data.error]) || DOWN };
  }
  const parsed = Result.safeParse(body);
  if (!parsed.success) return { ok: false, message: "O leitor de PDF respondeu fora do formato." };
  return { ok: true, rows: parsed.data.rows, warnings: parsed.data.warnings };
}
