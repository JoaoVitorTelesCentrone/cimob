import type postgres from "postgres";
import { adIdOf, type InboundMessage } from "../inbound/parse.ts";
import type { NewMessage } from "../inbound/process.ts";
import type { TokenSource } from "../outbound/tokens.ts";
import type { MediaDownloader } from "./media.ts";
import type { Transcriber } from "./transcribe-client.ts";

export type AudioDeps = {
  media: MediaDownloader;
  transcriber: Transcriber;
  tokens: TokenSource;
  /** O flow da conversa (createFlowHandler), rodado com o texto transcrito. */
  flow: (m: NewMessage) => Promise<void>;
  alert: (text: string) => Promise<void>;
  /** Depois do commit: enfileira o envio das respostas. */
  afterCommit: (conversationId: string) => Promise<void>;
};

type Row = {
  id: string;
  organization_id: string;
  conversation_id: string;
  wa_message_id: string;
  payload: Record<string, unknown>;
  phone_number_id: string | null;
  wa_contact: string;
  org_name: string;
};

/**
 * Worker da fila `transcribe` (doc 04): áudio de até 60 s vira texto e entra no flow como se fosse
 * digitado (evento `audio_transcribed`). Longo demais vai ao corretor; falha pede para escrever e
 * avisa a operação. O texto fica em `messages.body`; o arquivo de áudio não é guardado.
 */
export async function processAudio(
  sql: postgres.Sql,
  messageId: string,
  deps: AudioDeps,
): Promise<void> {
  const [row] = await sql<Row[]>`
    select m.id, m.organization_id, m.conversation_id, m.wa_message_id, m.payload,
           c.phone_number_id, c.wa_contact, o.name as org_name
    from messages m
    join conversations c on c.id = m.conversation_id
    join organizations o on o.id = m.organization_id
    where m.id = ${messageId} and m.type = 'audio' and m.body is null`;
  if (!row) return; // Já transcrito (ou não é áudio): nada a fazer.

  const audio = row.payload["audio"] as { id?: string; mime_type?: string } | undefined;
  let outcome: { text: string; seconds: number } | "too_long" | "failed";
  let failure = "";
  try {
    const token = row.phone_number_id ? await deps.tokens.get(row.phone_number_id) : null;
    if (!token) throw new Error("número sem token configurado");
    if (!audio?.id) throw new Error("mensagem sem id de mídia");
    const file = await deps.media(audio.id, token);
    const result = await deps.transcriber(file.bytes, audio.mime_type ?? file.mimeType);
    if (result.ok) outcome = { text: result.text, seconds: Math.round(result.durationS) };
    else if (result.reason === "too_long") outcome = "too_long";
    else {
      outcome = "failed";
      failure = result.error;
    }
  } catch (e) {
    outcome = "failed";
    failure = e instanceof Error ? e.message : String(e);
  }
  if (outcome === "failed") {
    await deps.alert(`Falha ao transcrever áudio (${row.org_name}): ${failure}`);
  }

  const others = new Set<string>();
  await sql.begin(async (tx) => {
    const [conv] = await tx<{ lead_id: string | null }[]>`
      select lead_id from conversations where id = ${row.conversation_id} for update`;
    const message: InboundMessage = {
      phoneNumberId: row.phone_number_id ?? "",
      waMessageId: row.wa_message_id,
      from: row.wa_contact,
      contactName: null,
      sentAt: new Date(),
      type: "audio",
      body: typeof outcome === "object" ? outcome.text : null,
      replyId: null,
      adId: adIdOf(row.payload),
      raw: row.payload,
      ...(typeof outcome === "object" ? {} : { audioOutcome: outcome }),
    };
    if (typeof outcome === "object") {
      await tx`update messages set body = ${outcome.text} where id = ${row.id}`;
    }
    await deps.flow({
      organizationId: row.organization_id,
      conversationId: row.conversation_id,
      leadId: conv?.lead_id ?? null,
      messageId: row.id,
      message,
      tx,
      notify: (id) => others.add(id),
      transcribe: () => undefined,
    });
    if (typeof outcome === "object") {
      // O lead pode ter nascido agora (áudio como primeira mensagem): lê de novo.
      const [linked] = await tx<{ lead_id: string | null }[]>`
        select lead_id from conversations where id = ${row.conversation_id}`;
      if (linked?.lead_id) {
        await tx`insert into lead_events (organization_id, lead_id, type, data)
                 values (${row.organization_id}, ${linked.lead_id}, 'audio_transcribed',
                         ${tx.json({ text: outcome.text, seconds: outcome.seconds })})`;
      }
    }
  });
  for (const id of [row.conversation_id, ...others]) await deps.afterCommit(id);
}
