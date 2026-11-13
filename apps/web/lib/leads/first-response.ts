type Timing = { assignedAt: Date | null; firstResponseAt: Date | null };

/** Registra a 1ª resposta do corretor; uma vez registrada, ela não muda. */
export function recordFirstResponse<T extends Timing>(lead: T, at: Date): T {
  return lead.firstResponseAt ? lead : { ...lead, firstResponseAt: at };
}

/** Minutos entre a atribuição e a 1ª resposta; nulo enquanto falta uma das duas. */
export function firstResponseMinutes(lead: Timing): number | null {
  if (!lead.assignedAt || !lead.firstResponseAt) return null;
  const ms = lead.firstResponseAt.getTime() - lead.assignedAt.getTime();
  return Math.max(0, ms / 60_000);
}
