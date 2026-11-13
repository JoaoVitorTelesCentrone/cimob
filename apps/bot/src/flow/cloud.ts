import type { Reply } from "./machine.ts";

const MAX_BUTTONS = 3;
const MAX_ROWS = 10;

/**
 * Corpo da mensagem no formato da Cloud API (POST /messages). Fica gravado em `messages.payload`;
 * o worker de envio (T2.6) só repassa. Erro aqui é bug de programação, não do contato.
 */
export function toCloudMessage(to: string, reply: Reply): Record<string, unknown> {
  const head = { messaging_product: "whatsapp", recipient_type: "individual", to };
  switch (reply.kind) {
    case "text":
      return { ...head, type: "text", text: { body: reply.body, preview_url: false } };
    case "buttons":
      if (reply.options.length > MAX_BUTTONS) throw new Error("WhatsApp aceita até 3 botões");
      return {
        ...head,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: reply.body },
          action: {
            buttons: reply.options.map((o) => ({
              type: "reply",
              reply: { id: o.id, title: o.title },
            })),
          },
        },
      };
    case "list":
      if (reply.options.length > MAX_ROWS)
        throw new Error("WhatsApp aceita até 10 linhas na lista");
      return {
        ...head,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: reply.body },
          action: {
            button: reply.button,
            sections: [
              { title: "Opções", rows: reply.options.map((o) => ({ id: o.id, title: o.title })) },
            ],
          },
        },
      };
  }
}
