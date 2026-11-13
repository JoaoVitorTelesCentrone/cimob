/** Opções das perguntas do bot. O título é o que o contato vê e o que vai para a ficha do lead. */
export type Option = { id: string; title: string; keywords?: readonly string[] };

export const HUMAN = { id: "human", title: "Atendente" } as const satisfies Option;

export const GOAL = [
  { id: "goal_live", title: "Morar" },
  { id: "goal_invest", title: "Investir", keywords: ["investir", "investimento", "renda"] },
] as const satisfies readonly Option[];

export type BudgetOption = Option & { max: number };
/** Faixas padrão (doc 04). `max` é o teto usado no critério de qualificação. */
export const BUDGET: readonly BudgetOption[] = [
  { id: "budget_1", title: "Até R$ 600 mil", max: 600_000 },
  { id: "budget_2", title: "R$ 600–800 mil", max: 800_000 },
  { id: "budget_3", title: "R$ 800 mil–1,2 mi", max: 1_200_000 },
  { id: "budget_4", title: "Acima de R$ 1,2 mi", max: Number.POSITIVE_INFINITY },
];

/** `months`: até quantos meses o contato pretende comprar (critério da imobiliária compara com ele). */
export type TimeframeOption = Option & { months: number };
export const TIMEFRAME: readonly TimeframeOption[] = [
  { id: "tf_now", title: "Imediato", months: 0 },
  { id: "tf_3m", title: "Até 3 meses", months: 3 },
  { id: "tf_6m", title: "3 a 6 meses", months: 6 },
  { id: "tf_later", title: "Mais de 6 meses", months: Number.POSITIVE_INFINITY },
];

export const VISIT = [
  { id: "visit_yes", title: "Sim", keywords: ["sim", "quero", "claro", "pode ser"] },
  { id: "visit_no", title: "Ainda não", keywords: ["ainda nao", "nao", "depois"] },
] as const satisfies readonly Option[];

/** Minúsculas, sem acento e com espaços simples: "Ainda NÃO " → "ainda nao". */
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, word: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escape(word)}($|[^\\p{L}\\p{N}])`, "u").test(text);

/**
 * Qual opção o contato escolheu: pelo id do botão/lista ou, se digitou, pelo título (ou sinônimo)
 * dentro da frase. Se a frase casa com mais de uma opção, é ambígua e não vale.
 */
export function matchOption<T extends Option>(
  options: readonly T[],
  input: { replyId: string | null; text: string | null },
): T | null {
  if (input.replyId) return options.find((o) => o.id === input.replyId) ?? null;
  if (!input.text) return null;
  const text = normalize(input.text);
  const hits = options.filter((o) =>
    [o.title, ...(o.keywords ?? [])].some((k) => hasWord(text, normalize(k))),
  );
  return hits.length === 1 ? (hits[0] ?? null) : null;
}
