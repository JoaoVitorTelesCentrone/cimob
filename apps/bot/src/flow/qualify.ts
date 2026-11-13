import type { BudgetOption, TimeframeOption } from "./options.ts";

/** Critério de qualificação da imobiliária (`organizations.qualify_*`, doc 04). */
export type Criteria = {
  /** Prazo máximo para qualificar: até 3 meses, até 6 meses ou qualquer prazo. */
  timeframe: "3m" | "6m" | "any";
  /** Fração do preço que o teto da faixa precisa cobrir (padrão 0,9). */
  priceShare: number;
};

export const DEFAULT_CRITERIA: Criteria = { timeframe: "6m", priceShare: 0.9 };

const MAX_MONTHS: Record<Criteria["timeframe"], number> = {
  "3m": 3,
  "6m": 6,
  any: Number.POSITIVE_INFINITY,
};

/**
 * Com unidade de interesse: prazo dentro do critério e faixa que cubra a fração pedida do preço.
 * Sem unidade (lead orgânico) ou sem preço na ficha: vale só o prazo. Padrão: 6 meses e 90%.
 */
export function qualifies(input: {
  budget: BudgetOption;
  timeframe: TimeframeOption;
  unitPrice: number | null;
  criteria?: Criteria;
}): boolean {
  const criteria = input.criteria ?? DEFAULT_CRITERIA;
  if (input.timeframe.months > MAX_MONTHS[criteria.timeframe]) return false;
  if (input.unitPrice === null) return true;
  return input.budget.max >= input.unitPrice * criteria.priceShare;
}
