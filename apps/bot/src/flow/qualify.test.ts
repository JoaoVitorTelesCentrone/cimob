import { describe, expect, it } from "vitest";
import { BUDGET, GOAL, HUMAN, TIMEFRAME, VISIT, matchOption } from "./options.ts";
import { qualifies } from "./qualify.ts";

const pick = <T extends { title: string }>(list: readonly T[], title: string): T => {
  const found = list.find((o) => o.title === title);
  if (!found) throw new Error(`opção desconhecida: ${title}`);
  return found;
};
const budget = (title: string) => pick(BUDGET, title);
const timeframe = (title: string) => pick(TIMEFRAME, title);

describe("opções", () => {
  it("cabem nos limites do WhatsApp (botão até 20 caracteres, linha de lista até 24)", () => {
    for (const o of [...GOAL, ...VISIT, HUMAN]) expect(o.title.length).toBeLessThanOrEqual(20);
    for (const o of [...BUDGET, ...TIMEFRAME]) expect(o.title.length).toBeLessThanOrEqual(24);
  });

  it("ids são únicos", () => {
    const ids = [...GOAL, ...BUDGET, ...TIMEFRAME, ...VISIT, HUMAN].map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("matchOption", () => {
  it("aceita o id do botão", () => {
    expect(matchOption(GOAL, { replyId: "goal_invest", text: "qualquer" })?.title).toBe("Investir");
  });

  it("aceita o título digitado, sem acento e maiúsculas, ou contido na frase", () => {
    expect(matchOption(GOAL, { replyId: null, text: "MORAR" })?.title).toBe("Morar");
    expect(matchOption(GOAL, { replyId: null, text: "quero morar lá" })?.title).toBe("Morar");
    expect(matchOption(VISIT, { replyId: null, text: "ainda nao" })?.title).toBe("Ainda não");
    expect(matchOption(TIMEFRAME, { replyId: null, text: "imediato" })?.title).toBe("Imediato");
  });

  it("sinônimos curtos de sim e não", () => {
    expect(matchOption(VISIT, { replyId: null, text: "sim, quero" })?.title).toBe("Sim");
    expect(matchOption(VISIT, { replyId: null, text: "não" })?.title).toBe("Ainda não");
  });

  it("ambíguo ou desconhecido não casa", () => {
    expect(matchOption(GOAL, { replyId: null, text: "morar ou investir, não sei" })).toBeNull();
    expect(matchOption(GOAL, { replyId: null, text: "banana" })).toBeNull();
    expect(matchOption(GOAL, { replyId: "budget_1", text: null })).toBeNull();
  });
});

describe("qualifies", () => {
  const unitPrice = 765_000;

  it("com unidade: prazo até 6 meses e teto da faixa ≥ 90% do preço", () => {
    expect(
      qualifies({
        budget: budget("R$ 600–800 mil"),
        timeframe: timeframe("Até 3 meses"),
        unitPrice,
      }),
    ).toBe(true);
    expect(
      qualifies({
        budget: budget("Até R$ 600 mil"),
        timeframe: timeframe("Até 3 meses"),
        unitPrice,
      }),
    ).toBe(false);
    expect(
      qualifies({
        budget: budget("Acima de R$ 1,2 mi"),
        timeframe: timeframe("Imediato"),
        unitPrice,
      }),
    ).toBe(true);
  });

  it("o limite de 90% é inclusivo", () => {
    expect(
      qualifies({
        budget: budget("Até R$ 600 mil"),
        timeframe: timeframe("Imediato"),
        unitPrice: 600_000 / 0.9,
      }),
    ).toBe(true);
  });

  it("mais de 6 meses nunca qualifica", () => {
    expect(
      qualifies({
        budget: budget("Acima de R$ 1,2 mi"),
        timeframe: timeframe("Mais de 6 meses"),
        unitPrice,
      }),
    ).toBe(false);
  });

  it("sem unidade (ou sem preço na ficha) vale só o prazo", () => {
    expect(
      qualifies({
        budget: budget("Até R$ 600 mil"),
        timeframe: timeframe("3 a 6 meses"),
        unitPrice: null,
      }),
    ).toBe(true);
    expect(
      qualifies({
        budget: budget("Até R$ 600 mil"),
        timeframe: timeframe("Mais de 6 meses"),
        unitPrice: null,
      }),
    ).toBe(false);
  });
});

describe("qualifies com o critério da imobiliária", () => {
  const unitPrice = 765_000;
  const strict = { timeframe: "3m", priceShare: 1 } as const;

  it("prazo de até 3 meses recusa '3 a 6 meses' e aceita 'Até 3 meses'", () => {
    const base = { budget: budget("R$ 800 mil–1,2 mi"), unitPrice, criteria: strict };
    expect(qualifies({ ...base, timeframe: timeframe("3 a 6 meses") })).toBe(false);
    expect(qualifies({ ...base, timeframe: timeframe("Até 3 meses") })).toBe(true);
  });

  it("faixa precisa cobrir a fração pedida do preço", () => {
    const base = { timeframe: timeframe("Imediato"), unitPrice, criteria: strict };
    // Teto de R$ 800 mil cobre 90% de 765 mil, mas não 100%.
    expect(qualifies({ ...base, budget: budget("R$ 600–800 mil") })).toBe(true);
    expect(qualifies({ ...base, unitPrice: 850_000, budget: budget("R$ 600–800 mil") })).toBe(false);
  });

  it("qualquer prazo aceita 'Mais de 6 meses'", () => {
    expect(
      qualifies({
        budget: budget("Acima de R$ 1,2 mi"),
        timeframe: timeframe("Mais de 6 meses"),
        unitPrice,
        criteria: { timeframe: "any", priceShare: 0.9 },
      }),
    ).toBe(true);
  });
});
