/** Brasília é UTC-3 o ano todo (sem horário de verão desde 2019). */
const OFFSET = "-03:00";
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Valor de `<input type="datetime-local">` (hora de Brasília) → Date; vazio → null; ilegível → undefined. */
export function fromLocalInput(raw: string): Date | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  if (!LOCAL.test(value)) return undefined;
  const date = new Date(`${value}:00${OFFSET}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Date → valor do campo datetime-local em hora de Brasília. */
export function toLocalInput(date: Date | null): string {
  if (!date) return "";
  return new Date(date.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);
}

const MAX_TEXT = 200;

export function parseNextStep(raw: { text: string; at: string }):
  | { ok: true; text: string | null; at: Date | null }
  | { ok: false; message: string } {
  const text = raw.text.trim();
  if (!text) return { ok: true, text: null, at: null };
  if (text.length > MAX_TEXT) return { ok: false, message: `Use até ${String(MAX_TEXT)} caracteres` };
  const at = fromLocalInput(raw.at);
  if (at === undefined) return { ok: false, message: "Data inválida" };
  return { ok: true, text, at };
}

export function parseVisit(raw: string): { ok: true; at: Date } | { ok: false; message: string } {
  const at = fromLocalInput(raw);
  if (at === null) return { ok: false, message: "Escolha a data da visita" };
  if (at === undefined) return { ok: false, message: "Data inválida" };
  return { ok: true, at };
}

/** Próximo passo com data que já passou. */
export function isNextStepOverdue(
  lead: { nextStep?: string | null; nextStepAt?: Date | null },
  now: Date,
): boolean {
  return Boolean(lead.nextStep && lead.nextStepAt && lead.nextStepAt.getTime() < now.getTime());
}
