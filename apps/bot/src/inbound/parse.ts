import { z } from "zod";

/** Uma mensagem recebida, já separada do envelope da Cloud API. */
export type InboundMessage = {
  phoneNumberId: string;
  waMessageId: string;
  /** wa_id do contato: só dígitos, com DDI. */
  from: string;
  contactName: string | null;
  sentAt: Date;
  type: string;
  /** Texto, título do botão escolhido ou legenda. Nulo para mídia sem legenda. */
  body: string | null;
  /** Id da opção escolhida em botões e listas (o flow decide por ele, não pelo texto). */
  replyId: string | null;
  /** Anúncio click-to-WhatsApp que trouxe a mensagem (`referral.source_id`), se houver. */
  adId: string | null;
  raw: Record<string, unknown>;
  /** Áudio que não virou texto (longo demais ou falha): o flow trata sem transcrição. */
  audioOutcome?: "too_long" | "failed";
};

const MAX_BODY = 4096;

const Reply = z.object({ id: z.string(), title: z.string() });
const Message = z.looseObject({
  id: z.string().min(1),
  from: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string().min(1),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({ button_reply: Reply.optional(), list_reply: Reply.optional() })
    .optional(),
  button: z.object({ text: z.string(), payload: z.string().optional() }).optional(),
  image: z.object({ caption: z.string().optional() }).optional(),
  video: z.object({ caption: z.string().optional() }).optional(),
  document: z.object({ caption: z.string().optional() }).optional(),
});
type Message = z.infer<typeof Message>;

const Value = z.object({
  metadata: z.object({ phone_number_id: z.string().min(1) }),
  contacts: z
    .array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).optional() }))
    .optional(),
  messages: z.array(z.unknown()).optional(),
});

const Payload = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({ changes: z.array(z.object({ field: z.string(), value: z.unknown() })) }),
  ),
});

const Referral = z.object({
  referral: z.object({ source_type: z.string(), source_id: z.string().min(1) }),
});

/** Id do anúncio click-to-WhatsApp na mensagem crua (`referral` de tipo "ad"), se houver. */
export function adIdOf(raw: unknown): string | null {
  const r = Referral.safeParse(raw);
  return r.success && r.data.referral.source_type === "ad" ? r.data.referral.source_id : null;
}

function content(m: Message): { body: string | null; replyId: string | null } {
  const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
  if (reply) return { body: reply.title, replyId: reply.id };
  if (m.button) return { body: m.button.text, replyId: m.button.payload ?? null };
  const body = m.text?.body ?? m.image?.caption ?? m.video?.caption ?? m.document?.caption;
  return { body: body ?? null, replyId: null };
}

/**
 * Extrai as mensagens de um payload do webhook. Avisos de entrega/leitura e itens malformados
 * são ignorados um a um: um item ruim não derruba o lote (senão a fila tentaria de novo para sempre).
 */
export function parseInbound(payload: unknown): InboundMessage[] {
  const parsed = Payload.safeParse(payload);
  if (!parsed.success) return [];

  const out: InboundMessage[] = [];
  for (const change of parsed.data.entry.flatMap((e) => e.changes)) {
    if (change.field !== "messages") continue;
    const value = Value.safeParse(change.value);
    if (!value.success) continue;
    const { metadata, contacts = [], messages = [] } = value.data;

    for (const item of messages) {
      const m = Message.safeParse(item);
      if (!m.success) continue;
      const { body, replyId } = content(m.data);
      out.push({
        phoneNumberId: metadata.phone_number_id,
        waMessageId: m.data.id,
        from: m.data.from,
        contactName: contacts.find((c) => c.wa_id === m.data.from)?.profile?.name ?? null,
        sentAt: new Date(Number(m.data.timestamp) * 1000),
        type: m.data.type,
        body: body === null ? null : body.slice(0, MAX_BODY),
        replyId,
        adId: adIdOf(m.data),
        raw: m.data,
      });
    }
  }
  return out;
}
