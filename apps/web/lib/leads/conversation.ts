/** Mensagem da conversa do lead, como vem do banco (`messages`). */
export type MessageRow = {
  direction: "inbound" | "outbound";
  type: string;
  body: string | null;
  createdAt: Date;
  /** Só nas mensagens do bot: na fila, aceita pela Meta ou recusada. */
  sendStatus: "pending" | "sent" | "failed" | null;
  deliveredAt: Date | null;
  readAt: Date | null;
};

export type DeliveryLabel = "Na fila" | "Enviada" | "Entregue" | "Lida" | "Não entregue";

export type ConversationLine = {
  from: "contact" | "bot";
  text: string;
  at: Date;
  status: DeliveryLabel | null;
};

export const EMPTY_CONVERSATION = "Sem conversa com o bot ainda.";

/** Status de entrega de uma mensagem do bot; recusa vale mais (a Meta avisa depois de aceitar). */
export function deliveryLabel(m: MessageRow): DeliveryLabel | null {
  if (m.direction === "inbound") return null;
  if (m.sendStatus === "failed") return "Não entregue";
  if (m.sendStatus === "pending" || m.sendStatus === null) return "Na fila";
  if (m.readAt) return "Lida";
  if (m.deliveredAt) return "Entregue";
  return "Enviada";
}

/** Mensagem sem texto: o tipo, em português (o tipo cru da Meta não aparece na tela). */
const TYPE_LABEL: Record<string, string> = {
  audio: "Áudio (sem transcrição)",
  image: "Imagem",
  video: "Vídeo",
  document: "Documento",
  sticker: "Figurinha",
  location: "Localização",
  contacts: "Contato compartilhado",
  template: "Mensagem modelo do WhatsApp",
};

const textOf = (m: MessageRow) => m.body || (TYPE_LABEL[m.type] ?? "Mensagem sem texto");

/** Conversa em ordem cronológica, pronta para a ficha. */
export function buildConversation(rows: readonly MessageRow[]): ConversationLine[] {
  return [...rows]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((m) => ({
      from: m.direction === "inbound" ? "contact" : "bot",
      text: textOf(m),
      at: m.createdAt,
      status: deliveryLabel(m),
    }));
}
