export const STAGES = [
  "new",
  "qualified",
  "contacted",
  "visit_scheduled",
  "visit_done",
  "proposal",
  "won",
  "lost",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "Novo",
  qualified: "Qualificado",
  contacted: "Em atendimento",
  visit_scheduled: "Visita agendada",
  visit_done: "Visita feita",
  proposal: "Proposta",
  won: "Ganho",
  lost: "Perdido",
};

export const isStage = (value: string): value is Stage =>
  (STAGES as readonly string[]).includes(value);
