import { normalize } from "./options.ts";

/** Por que o lead foi passado ao corretor. O rótulo é o que aparece no CRM. */
export const HANDOFF_LABEL = {
  qualified: "qualificado",
  requested: "pediu atendente",
  not_understood: "não entendido",
  audio_long: "áudio longo",
} as const;
export type HandoffReason = keyof typeof HANDOFF_LABEL;

/** Aviso de privacidade mostrado na saudação; é este texto que vai para `consents.text_shown`. */
export function privacyNotice(policyUrl: string | null): string {
  const base = "Seus dados são usados só para este atendimento, conforme a LGPD.";
  return policyUrl ? `${base} Política: ${policyUrl}` : base;
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
/** Intl usa espaço não separável depois do "R$"; no WhatsApp fica melhor o espaço comum. */
export const formatPrice = (value: number) => money.format(value).replace(/\s/g, " ");

const PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);
const MAX_NAME = 60;

/** "ana souza" → "Ana Souza". Nulo se não houver letra (o bot pergunta de novo). */
export function properName(raw: string): string | null {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (!words.some((w) => /\p{L}/u.test(w))) return null;
  const name = words
    .map((w, i) => {
      const lower = w.toLocaleLowerCase("pt-BR");
      if (i > 0 && PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
  return name.slice(0, MAX_NAME);
}

const has = (text: string, pattern: RegExp) => pattern.test(normalize(text));

/** Pedido de pessoa: "atendente", "corretor", "humano". */
export const wantsHuman = (text: string) => has(text, /\b(atendente|corretora?|humano)\b/);

/** Pergunta de preço. A resposta usa só o valor da ficha (o bot nunca negocia). */
export const asksPrice = (text: string) =>
  has(text, /\b(preco|valor|quanto custa|quanto e|quanto fica)\b/);

export const isQuestion = (text: string) => text.trim().endsWith("?");
