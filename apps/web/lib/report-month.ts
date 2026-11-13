import { monthRange } from "@c1imob/reports";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Mês atual em Brasília ("AAAA-MM"). */
function currentMonth(now: Date): string {
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return `${String(br.getUTCFullYear())}-${String(br.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mês do relatório: o do endereço (se válido e não futuro) ou o último mês fechado. */
export function parseMonth(raw: string | string[] | undefined, now: Date): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const current = currentMonth(now);
  if (value && MONTH.test(value) && value <= current) return value;
  return monthRange(current).previous;
}

/** Os últimos 12 meses para o seletor, do mais recente ao mais antigo. */
export function monthOptions(now: Date): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  let month = currentMonth(now);
  for (let i = 0; i < 12; i++) {
    const r = monthRange(month);
    out.push({ value: month, label: r.label });
    month = r.previous;
  }
  return out;
}
