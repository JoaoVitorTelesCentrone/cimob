import { STAGE_LABEL, STAGES, type Stage } from "./stages";

export type LeadEvent = { type: string; data: Record<string, unknown>; actorId: string | null };
export type EventText = { title: string; detail: string | null };

const HANDOFF: Record<string, string> = {
  qualified: "qualificado",
  requested: "pediu atendente",
  not_understood: "não entendido",
  audio_long: "áudio longo",
};
const isStage = (v: unknown): v is Stage => typeof v === "string" && (STAGES as readonly string[]).includes(v);
const stage = (v: unknown) => (isStage(v) ? STAGE_LABEL[v] : "—");
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const quote = (v: unknown) => {
  const s = str(v);
  return s ? `“${s.length > 140 ? `${s.slice(0, 140)}…` : s}”` : null;
};
const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" · ") || null;

/** Histórico da ficha em português: o que aconteceu e o detalhe (de/para, quem, motivo). */
export function describeEvent(e: LeadEvent, names: ReadonlyMap<string, string>): EventText {
  const who = (id: unknown) => (typeof id === "string" ? names.get(id) : undefined);
  const by = who(e.actorId);
  switch (e.type) {
    case "stage_changed":
      return {
        title: `${stage(e.data["from"])} → ${stage(e.data["to"])}`,
        detail: join(by ? `por ${by}` : null, str(e.data["reason"]) ? `motivo: ${String(e.data["reason"])}` : null),
      };
    case "assigned":
      return {
        title: `Atribuído a ${who(e.data["to"]) ?? "outro membro"}`,
        detail: e.data["by"] === "rotation" ? "pelo rodízio" : by ? `por ${by}` : null,
      };
    case "handoff":
      return {
        title: "Passado ao corretor",
        detail: join(
          HANDOFF[String(e.data["reason"])] ?? null,
          e.data["assigned"] === false ? "ninguém no rodízio" : null,
        ),
      };
    case "question_for_agent":
      return { title: "Pergunta para o corretor", detail: quote(e.data["question"]) };
    case "nurture":
      return { title: "Foi para nutrição", detail: "fora do critério de qualificação" };
    case "audio_transcribed":
      return {
        title: typeof e.data["seconds"] === "number" ? `Áudio transcrito (${String(e.data["seconds"])} s)` : "Áudio transcrito",
        detail: quote(e.data["text"]),
      };
    case "agent_reply":
      return { title: "Corretor respondeu", detail: e.data["via"] === "crm" ? "pelo CRM" : "pelo WhatsApp" };
    case "first_response":
      return { title: "1ª resposta registrada", detail: by ? `por ${by}` : null };
    case "next_step":
      return { title: "Próximo passo", detail: join(str(e.data["text"]), by ? `por ${by}` : null) };
    case "visit_scheduled_at":
      return { title: "Data da visita marcada", detail: by ? `por ${by}` : null };
    case "stage_followup_sent":
      return { title: "Pergunta de estágio enviada ao corretor", detail: null };
    case "agent_not_notified":
      return { title: "Corretor não avisado", detail: str(e.data["reason"]) };
    case "llm_error":
      return { title: "IA não entendeu a mensagem", detail: "o bot seguiu com as perguntas fixas" };
    case "consent":
      return { title: "Aceitou o aviso de privacidade", detail: null };
    case "data_exported":
      return { title: "Dados exportados (LGPD)", detail: by ? `por ${by}` : null };
    default:
      return { title: e.type, detail: null };
  }
}
