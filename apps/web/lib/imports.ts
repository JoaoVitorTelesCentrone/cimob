import { formatArea, formatPrice, STATUS_LABEL, type UnitStatus } from "./inventory";

/** Linha do rascunho (o que o services/ingest leu do PDF). Nulo = não deu para ler. */
export type ImportRow = {
  code: string;
  floor: number | null;
  areaM2: number | null;
  bedrooms: number | null;
  parking: number | null;
  price: number | null;
  status: UnitStatus | null;
  needsReview: boolean;
  issues: string[];
};

export type CurrentUnit = {
  code: string;
  developmentId: string;
  floor: number | null;
  areaM2: number | null;
  bedrooms: number | null;
  price: number | null;
  status: UnitStatus;
};

export type ReviewKind = "nova" | "muda" | "igual" | "conflito";
export type ReviewRow = ImportRow & { kind: ReviewKind; changes: string[] };
export type Review = {
  rows: ReviewRow[];
  counts: Record<ReviewKind | "revisar", number>;
  /** Código que já é de outro empreendimento impede publicar (o banco também recusa). */
  canPublish: boolean;
};

const change = <T>(label: string, before: T | null, after: T | null, fmt: (v: T | null) => string) =>
  after !== null && after !== before ? [`${label} ${fmt(before)} → ${fmt(after)}`] : [];

/** O que publicar vai fazer com cada linha (mesma regra de publish_unit_import). */
export function reviewImport(
  rows: readonly ImportRow[],
  current: readonly CurrentUnit[],
  developmentId: string,
): Review {
  const byCode = new Map(current.map((u) => [u.code, u]));
  const reviewed = rows.map((r): ReviewRow => {
    const unit = byCode.get(r.code);
    if (!unit) {
      const changes = r.status === null ? ["entra como Reservado (situação ilegível)"] : [];
      return { ...r, kind: "nova", changes };
    }
    if (unit.developmentId !== developmentId) {
      return { ...r, kind: "conflito", changes: ["código já é de outro empreendimento"] };
    }
    const changes = [
      ...change("andar", unit.floor, r.floor, (v) => (v === null ? "—" : `${String(v)}º`)),
      ...change("área", unit.areaM2, r.areaM2, formatArea),
      ...change("quartos", unit.bedrooms, r.bedrooms, (v) => (v === null ? "—" : String(v))),
      ...change("preço", unit.price, r.price, formatPrice),
      ...change("situação", unit.status, r.status, (v) => (v === null ? "—" : STATUS_LABEL[v])),
    ];
    return { ...r, kind: changes.length > 0 ? "muda" : "igual", changes };
  });

  const count = (k: ReviewKind) => reviewed.filter((r) => r.kind === k).length;
  return {
    rows: reviewed,
    counts: {
      nova: count("nova"),
      muda: count("muda"),
      igual: count("igual"),
      conflito: count("conflito"),
      revisar: reviewed.filter((r) => r.needsReview).length,
    },
    canPublish: count("conflito") === 0,
  };
}

/** Prefixo mais comum dos códigos ("AUR-501" → "AUR-"): vale para código só com número no PDF. */
export function codePrefix(codes: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const code of codes) {
    const prefix = /^([A-Z]+-)\d/.exec(code)?.[1];
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

export const IMPORT_STATUS = { draft: "Rascunho", published: "Publicada", discarded: "Descartada" } as const;
export const KIND_LABEL: Record<ReviewKind, string> = {
  nova: "Nova",
  muda: "Muda",
  igual: "Igual",
  conflito: "Conflito",
};
