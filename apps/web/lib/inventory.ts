import { z } from "zod";

export const UNIT_STATUSES = ["available", "reserved", "sold"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const isUnitStatus = (value: string): value is UnitStatus =>
  (UNIT_STATUSES as readonly string[]).includes(value);

export const STATUS_LABEL: Record<UnitStatus, string> = {
  available: "Disponível",
  reserved: "Reservado",
  sold: "Vendido",
};

/** Token de cor de cada status. Fixo: não muda com a marca do cliente (regra 7 do AGENTS.md). */
export const STATUS_COLOR: Record<UnitStatus, "available" | "reserved" | "sold"> = {
  available: "available",
  reserved: "reserved",
  sold: "sold",
};

export const STATUS_CLASS: Record<UnitStatus, string> = {
  available: "bg-available-soft text-available-ink",
  reserved: "bg-reserved-soft text-reserved-ink",
  sold: "bg-sold-soft text-sold-ink",
};

export type UnitRow = {
  id: string;
  developmentName: string;
  code: string;
  floor: number | null;
  areaM2: number | null;
  bedrooms: number | null;
  price: number | null;
  status: UnitStatus;
};

export type DevelopmentGroup = { development: string; summary: string; units: UnitRow[] };
export type Inventory = DevelopmentGroup[];

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Intl usa espaço não separável entre "R$" e o número; trocamos por espaço comum. */
export const formatPrice = (value: number | null) =>
  value === null ? "—" : money.format(value).replace(/\s/g, " ");

export const formatArea = (value: number | null) =>
  value === null ? "—" : `${decimal.format(value)} m²`;

const formatFloor = (floor: number | null) =>
  floor === null ? "—" : floor === 0 ? "Térreo" : `${String(floor)}º`;

export function formatUnit(u: UnitRow) {
  return {
    floor: formatFloor(u.floor),
    area: formatArea(u.areaM2),
    price: formatPrice(u.price),
    status: STATUS_LABEL[u.status],
  };
}

export function parseStatusFilter(raw: string | string[] | undefined): UnitStatus | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && isUnitStatus(value) ? value : null;
}

const COUNT_WORDS: Record<UnitStatus, [string, string]> = {
  available: ["disponível", "disponíveis"],
  reserved: ["reservada", "reservadas"],
  sold: ["vendida", "vendidas"],
};

export function summarize(units: readonly UnitRow[]): string {
  return UNIT_STATUSES.map((s) => {
    const n = units.filter((u) => u.status === s).length;
    return `${String(n)} ${COUNT_WORDS[s][n === 1 ? 0 : 1]}`;
  }).join(" · ");
}

const byFloorAndCode = (a: UnitRow, b: UnitRow) =>
  (a.floor ?? Infinity) - (b.floor ?? Infinity) ||
  a.code.localeCompare(b.code, "pt-BR", { numeric: true });

/** Agrupa por empreendimento. O resumo conta todas as unidades; o filtro só esconde linhas. */
export function buildInventory(units: readonly UnitRow[], status: UnitStatus | null): Inventory {
  return [...Map.groupBy(units, (u) => u.developmentName)]
    .map(([development, all]) => ({
      development,
      summary: summarize(all),
      units: all.filter((u) => !status || u.status === status).sort(byFloorAndCode),
    }))
    .filter((g) => g.units.length > 0)
    .sort((a, b) => a.development.localeCompare(b.development, "pt-BR"));
}

export type StatusPlan =
  { kind: "noop" } | { kind: "change"; to: UnitStatus } | { kind: "error"; message: string };

/** Decide se a mudança de status pode ser salva. `expected` é o status que a tela mostrava. */
export function planStatusChange(input: {
  canEdit: boolean;
  current: UnitStatus;
  expected: string;
  to: string;
}): StatusPlan {
  if (!input.canEdit) return { kind: "error", message: "Só o gestor muda o status" };
  if (!isUnitStatus(input.to)) return { kind: "error", message: "Status inválido" };
  if (input.expected !== input.current) {
    return {
      kind: "error",
      message: "Esta unidade foi alterada por outra pessoa. Atualize a página.",
    };
  }
  if (input.to === input.current) return { kind: "noop" };
  return { kind: "change", to: input.to };
}

const StatusChange = z.object({
  kind: z.enum(["unit", "property"]),
  id: z.uuid(),
  expected: z.string().max(20),
  to: z.string().max(20),
});

export function parseStatusChange(raw: unknown): z.infer<typeof StatusChange> | null {
  const parsed = StatusChange.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
