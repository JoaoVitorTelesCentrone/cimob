/** Dias reimportados a cada rodada: a Meta ainda ajusta o gasto dos dias recentes. */
export const IMPORT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Data (AAAA-MM-DD) no fuso de Brasília. en-CA formata como ISO. */
const brDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Período da importação: de `days - 1` dias atrás até hoje, em datas de Brasília (decisão da
 * T3.4: hora de Brasília para todos; a conta de anúncios costuma usar o mesmo fuso).
 */
export function importWindow(today: Date, days = IMPORT_DAYS): { since: string; until: string } {
  const until = brDate.format(today);
  // Meio-dia UTC da data de hoje: subtrair dias inteiros não cai em outro dia por horário de verão.
  const noon = new Date(`${until}T12:00:00Z`).getTime();
  const since = new Date(noon - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  return { since, until };
}
