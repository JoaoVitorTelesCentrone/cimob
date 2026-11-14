import type { BusinessHours } from "@c1imob/core";
import { applyList, parseListParams, type LeadRow } from "./list";
import { isStage, STAGES, STAGE_LABEL, type Stage } from "./stages";

export type Column = { stage: Stage; label: string; leads: LeadRow[] };
export type Board = Column[];

/** Uma coluna por estágio, na ordem do funil; dentro dela, atrasados primeiro e depois os mais recentes. */
export function buildBoard(
  leads: readonly LeadRow[],
  now: Date,
  hours: BusinessHours | null = null,
): Board {
  const sorted = applyList(leads, parseListParams({}), now, hours);
  return STAGES.map((stage) => ({
    stage,
    label: STAGE_LABEL[stage],
    leads: sorted.filter((l) => l.stage === stage),
  }));
}

export const MAX_REASON = 300;

export type MovePlan =
  | { kind: "noop" }
  | { kind: "move"; to: Stage; lostReason: string | null }
  | { kind: "error"; message: string; needsReason?: true };

/**
 * Decide se um arraste pode ser salvo.
 * `current` é o estágio no banco; `expected` é o que a tela mostrava quando o usuário arrastou.
 */
export function planMove(input: {
  current: Stage;
  expected: string;
  to: string;
  reason?: string | undefined;
}): MovePlan {
  const { current, expected, to } = input;
  if (!isStage(to)) return { kind: "error", message: "Etapa inválida" };
  if (expected !== current) {
    return {
      kind: "error",
      message: "Este lead foi alterado por outra pessoa. Atualize a página.",
    };
  }
  if (to === current) return { kind: "noop" };
  if (to !== "lost") return { kind: "move", to, lostReason: null };

  const reason = (input.reason ?? "").trim();
  if (!reason) return { kind: "error", message: "Informe o motivo da perda", needsReason: true };
  if (reason.length > MAX_REASON) {
    return {
      kind: "error",
      message: `O motivo pode ter no máximo ${String(MAX_REASON)} caracteres`,
      needsReason: true,
    };
  }
  return { kind: "move", to, lostReason: reason };
}
