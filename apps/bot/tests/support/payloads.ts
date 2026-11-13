/** Payloads no formato da WhatsApp Cloud API (webhook `messages`), para os testes. */

type Message = Record<string, unknown>;

export function envelope(phoneNumberId: string, value: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "5511999990000", phone_number_id: phoneNumberId },
              ...value,
            },
          },
        ],
      },
    ],
  };
}

const withContact = (phoneNumberId: string, from: string, message: Message) =>
  envelope(phoneNumberId, {
    contacts: [{ profile: { name: "Contato" }, wa_id: from }],
    messages: [{ from, timestamp: "1763000000", ...message }],
  });

export const textMessage = (id: string, from: string, to: string, body: string) =>
  withContact(to, from, { id, type: "text", text: { body } });

/** Mensagem vinda de um anúncio click-to-WhatsApp: a Meta manda o `referral` com o id do anúncio. */
export const adTextMessage = (id: string, from: string, to: string, body: string, adId: string) =>
  withContact(to, from, {
    id,
    type: "text",
    text: { body },
    referral: {
      source_url: "https://fb.me/abc123",
      source_id: adId,
      source_type: "ad",
      headline: "Residencial Aurora",
      body: "Conheça o AUR-502",
      media_type: "image",
    },
  });

export const buttonReply = (id: string, from: string, to: string, title: string, replyId: string) =>
  withContact(to, from, {
    id,
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: replyId, title } },
  });

export const audioMessage = (id: string, from: string, to: string, mediaId = "MEDIA_ID") =>
  withContact(to, from, {
    id,
    type: "audio",
    audio: { id: mediaId, mime_type: "audio/ogg; codecs=opus", voice: true },
  });

export const readStatus = (to: string) =>
  envelope(to, {
    statuses: [
      { id: "wamid.OUT1", status: "read", timestamp: "1763000100", recipient_id: "5511987654321" },
    ],
  });

export const listReply = (id: string, from: string, to: string, title: string, replyId: string) =>
  withContact(to, from, {
    id,
    type: "interactive",
    interactive: { type: "list_reply", list_reply: { id: replyId, title } },
  });

/** Toque num botão de resposta rápida de um modelo (template): a Meta manda o texto e o payload. */
export const templateButton = (
  id: string,
  from: string,
  to: string,
  text: string,
  payload: string,
) => withContact(to, from, { id, type: "button", button: { text, payload } });
