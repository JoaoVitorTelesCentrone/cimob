/**
 * Modelos (templates) de mensagem ao corretor. Modelo aprovado pela Meta pode ser enviado fora da
 * janela de 24 h, então o resumo chega mesmo que o corretor nunca tenha escrito para o número.
 * Os textos ficam cadastrados na Meta (ver docs/04-bot-whatsapp.md); aqui só vão os parâmetros.
 */

export const NEW_LEAD_TEMPLATE = "novo_lead";
export const STAGE_TEMPLATE = "atualizar_lead";
export const TEMPLATE_LANGUAGE = "pt_BR";

/** Botão do modelo novo_lead (o título é o cadastrado na Meta). */
export const RESPONDED_BUTTON = "Já respondi";

/** Botões do modelo atualizar_lead, na ordem do doc 04 (1 a 5). */
export const STAGE_OPTIONS = [
  { code: "visit_scheduled", title: "Visita marcada" },
  { code: "visit_done", title: "Visita feita" },
  { code: "proposal", title: "Proposta" },
  { code: "no_response", title: "Sem resposta" },
  { code: "lost", title: "Perdido" },
] as const;
export type StageCode = (typeof STAGE_OPTIONS)[number]["code"];

const MAX_PARAM = 200;

/** A Meta recusa parâmetro vazio, com quebra de linha, tabulação ou mais de 4 espaços seguidos. */
export function param(text: string | null): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PARAM);
  return clean || "—";
}

const head = (to: string) => ({ messaging_product: "whatsapp", recipient_type: "individual", to });
const body = (texts: (string | null)[]) => ({
  type: "body",
  parameters: texts.map((t) => ({ type: "text", text: param(t) })),
});
const quickReply = (index: number, payload: string) => ({
  type: "button",
  sub_type: "quick_reply",
  index: String(index),
  parameters: [{ type: "payload", payload }],
});

/**
 * Corpo do modelo novo_lead:
 * "Novo lead para você: {{1}} ({{2}}). Perfil: {{3}}. Perguntou: {{4}}. Responda em até 15 min: {{5}}"
 */
export function newLeadTemplate(
  to: string,
  lead: {
    leadId: string;
    leadName: string | null;
    unit: string | null;
    profile: string;
    question: string | null;
    contactLink: string;
  },
): Record<string, unknown> {
  return {
    ...head(to),
    type: "template",
    template: {
      name: NEW_LEAD_TEMPLATE,
      language: { code: TEMPLATE_LANGUAGE },
      components: [
        body([
          lead.leadName,
          lead.unit ?? "sem unidade",
          lead.profile,
          lead.question,
          lead.contactLink,
        ]),
        quickReply(0, `responded:${lead.leadId}`),
      ],
    },
  };
}

/** Corpo do modelo atualizar_lead: "Como está o lead {{1}} ({{2}})? Toque na opção." */
export function stageTemplate(
  to: string,
  lead: { leadId: string; leadName: string | null; unit: string | null },
): Record<string, unknown> {
  return {
    ...head(to),
    type: "template",
    template: {
      name: STAGE_TEMPLATE,
      language: { code: TEMPLATE_LANGUAGE },
      components: [
        body([lead.leadName, lead.unit ?? "sem unidade"]),
        ...STAGE_OPTIONS.map((o, i) => quickReply(i, `stage:${o.code}:${lead.leadId}`)),
      ],
    },
  };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RESPONDED = new RegExp(`^responded:(${UUID})$`);
const STAGE = new RegExp(`^stage:(${STAGE_OPTIONS.map((o) => o.code).join("|")}):(${UUID})$`);

export type AgentReply =
  { kind: "responded"; leadId: string } | { kind: "stage"; code: StageCode; leadId: string };

/** Lê o payload do botão que o corretor tocou. Qualquer outra coisa é ignorada. */
export function parseAgentReply(payload: string | null): AgentReply | null {
  if (!payload) return null;
  const responded = RESPONDED.exec(payload);
  if (responded?.[1]) return { kind: "responded", leadId: responded[1] };
  const stage = STAGE.exec(payload);
  if (stage?.[1] && stage[2])
    return { kind: "stage", code: stage[1] as StageCode, leadId: stage[2] };
  return null;
}
