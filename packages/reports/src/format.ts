export type ValueKind = "count" | "money" | "minutes";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Mês "AAAA-MM" em Brasília (UTC-3, sem horário de verão desde 2019): do dia 1º à meia-noite até
 * o 1º do mês seguinte. Leads contam pelo mês em que chegaram.
 */
export function monthRange(month: string) {
  const m = MONTH.exec(month);
  if (!m) throw new Error(`mês inválido: ${month} (use AAAA-MM)`);
  const year = Number(m[1]);
  const index = Number(m[2]) - 1;
  const at = (y: number, i: number) => new Date(Date.UTC(y, i, 1, 3));
  const prev = index === 0 ? [year - 1, 11] : [year, index - 1];
  return {
    start: at(year, index),
    end: index === 11 ? at(year + 1, 0) : at(year, index + 1),
    /** Primeiro e último dia (datas do gasto da Meta, que já vêm por dia). */
    firstDay: `${String(year)}-${pad(index + 1)}-01`,
    nextFirstDay: index === 11 ? `${String(year + 1)}-01-01` : `${String(year)}-${pad(index + 2)}-01`,
    previous: `${String(prev[0])}-${pad((prev[1] ?? 0) + 1)}`,
    label: `${NAMES[index] ?? ""} de ${String(year)}`,
  };
}

const money = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatValue(value: number | null, kind: ValueKind): string {
  if (value === null) return "–";
  if (kind === "money") return money.format(value);
  if (kind === "minutes") return `${String(Math.round(value))} min`;
  return String(value);
}

/** "+2 (+100%)" contra o mês anterior; sem base (anterior nulo ou zero) não inventa porcentagem. */
export function formatDelta(value: number | null, previous: number | null, kind: ValueKind): string {
  if (value === null || previous === null) return "–";
  const diff = value - previous;
  if (diff === 0) return "igual";
  const sign = diff > 0 ? "+" : "-";
  const abs = kind === "money" ? money.format(Math.abs(diff)) : String(Math.round(Math.abs(diff)));
  if (previous === 0) return `${sign}${abs}`;
  return `${sign}${abs} (${sign}${String(Math.round(Math.abs(diff / previous) * 100))}%)`;
}
