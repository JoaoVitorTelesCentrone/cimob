import type { Stage } from "./stages";

/** Cores fixas de etapa (não mudam com a marca do cliente). Mesmo mapeamento do bundle do design system. */
export const STAGE_CLASS: Record<Stage, string> = {
  new: "bg-stage-new-soft text-stage-new",
  qualified: "bg-stage-qualified-soft text-stage-qualified",
  contacted: "bg-stage-contact-soft text-stage-contact",
  visit_scheduled: "bg-reserved-soft text-reserved-ink",
  visit_done: "bg-reserved-soft text-reserved-ink",
  proposal: "bg-stage-proposal-soft text-stage-proposal",
  won: "bg-available-soft text-available-ink",
  lost: "bg-sold-soft text-sold-ink",
};
