/**
 * Horário de atendimento da imobiliária (`organizations.business_hours`). Dias da semana de 0
 * (domingo) a 6 e uma janela HH:MM–HH:MM, em hora de Brasília (UTC−3, sem horário de verão).
 * Sem horário configurado (nulo), tudo vale como tempo corrido.
 */
export type BusinessHours = { days: number[]; open: string; close: string };

const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const minutesOf = (hhmm: string) => {
  const m = HHMM.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN;
};

export function parseBusinessHours(raw: unknown): BusinessHours | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const days = Array.isArray(r["days"]) ? r["days"] : [];
  if (
    days.length === 0 ||
    !days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
  ) {
    return null;
  }
  const open = typeof r["open"] === "string" ? r["open"] : "";
  const close = typeof r["close"] === "string" ? r["close"] : "";
  if (!(minutesOf(open) < minutesOf(close))) return null;
  return { days: [...new Set(days as number[])].sort((a, b) => a - b), open, close };
}

/** Meia-noite (em Brasília) do dia de `at`, como instante UTC. */
const startOfDay = (at: Date) => {
  const local = at.getTime() - OFFSET_MS;
  return local - (((local % DAY_MS) + DAY_MS) % DAY_MS) + OFFSET_MS;
};
const weekday = (dayStart: number) => new Date(dayStart - OFFSET_MS).getUTCDay();
const windowOf = (dayStart: number, h: BusinessHours) => ({
  open: dayStart + minutesOf(h.open) * 60_000,
  close: dayStart + minutesOf(h.close) * 60_000,
});

export function isOpen(at: Date, h: BusinessHours): boolean {
  const day = startOfDay(at);
  if (!h.days.includes(weekday(day))) return false;
  const w = windowOf(day, h);
  return at.getTime() >= w.open && at.getTime() < w.close;
}

/** Quando o atendimento abre (ou `at`, se já estiver aberto). */
export function nextOpening(at: Date, h: BusinessHours): Date {
  if (isOpen(at, h)) return at;
  for (let d = 0; d <= 7; d++) {
    const day = startOfDay(at) + d * DAY_MS;
    if (!h.days.includes(weekday(day))) continue;
    const w = windowOf(day, h);
    if (w.open >= at.getTime()) return new Date(w.open);
  }
  return at; // não acontece: há ao menos um dia na semana
}

/** Milissegundos dentro do horário entre `from` e `to` (tempo corrido sem horário configurado). */
export function businessMsBetween(from: Date, to: Date, h: BusinessHours | null): number {
  const start = from.getTime();
  const end = to.getTime();
  if (end <= start) return 0;
  if (!h) return end - start;
  let total = 0;
  for (let day = startOfDay(from); day < end; day += DAY_MS) {
    if (!h.days.includes(weekday(day))) continue;
    const w = windowOf(day, h);
    total += Math.max(0, Math.min(end, w.close) - Math.max(start, w.open));
  }
  return total;
}

/** Minutos dentro do horário entre `from` e `to` (tempo corrido sem horário configurado). */
export function businessMinutesBetween(from: Date, to: Date, h: BusinessHours | null): number {
  return Math.round(businessMsBetween(from, to, h) / 60_000);
}
