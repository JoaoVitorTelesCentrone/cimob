import type postgres from "postgres";
import { parseInbound, type InboundMessage } from "./parse.ts";
import type { InboundStore } from "./store.ts";

/** O que o bot (flow, T2.3) recebe para cada mensagem nova. `tx` = mesma transação da gravação. */
export type NewMessage = {
  organizationId: string;
  conversationId: string;
  leadId: string | null;
  message: InboundMessage;
  tx: postgres.TransactionSql;
  /** Id da mensagem recebida (gravada nesta transação). */
  messageId: string;
  /** Avisa que outra conversa (ex.: a do corretor) ganhou mensagens para enviar. */
  notify: (conversationId: string) => void;
  /** Pede a transcrição deste áudio (fila `transcribe`, depois do commit). */
  transcribe: () => void;
};

/** Logs sem texto nem telefone do contato (LGPD). */
export type InboundLog =
  | { level: "warn"; event: "unknown_phone_number_id"; phoneNumberId: string }
  | { level: "info"; event: "duplicate_message"; waMessageId: string };

export type InboundDeps = {
  store: InboundStore;
  onMessage: (m: NewMessage) => Promise<void>;
  log: (entry: InboundLog) => void;
  /** Chamado depois do commit de cada mensagem nova (enfileira o envio das respostas, T2.6). */
  afterCommit?: (conversationId: string) => Promise<void>;
  /** Chamado depois do commit para cada áudio que o flow mandou transcrever (T2.8). */
  onTranscribe?: (messageId: string) => Promise<void>;
};

/**
 * Processa um job da fila `inbound`. Número que não é de nenhuma imobiliária é descartado (tentar
 * de novo não muda nada); qualquer outro erro sobe, e o BullMQ tenta de novo com espera crescente.
 */
export async function processInbound(payload: unknown, deps: InboundDeps): Promise<void> {
  for (const message of parseInbound(payload)) {
    const organizationId = await deps.store.findOrganization(message.phoneNumberId);
    if (!organizationId) {
      deps.log({
        level: "warn",
        event: "unknown_phone_number_id",
        phoneNumberId: message.phoneNumberId,
      });
      continue;
    }
    const others = new Set<string>();
    // Lido por função: o lint não enxerga a escrita feita dentro do callback e acusaria "sempre nulo".
    const pending: { transcribe: string | null } = { transcribe: null };
    const toTranscribe = () => pending.transcribe;
    const { isNew, conversationId } = await deps.store.recordInbound(
      organizationId,
      message,
      (recorded, tx) =>
        deps.onMessage({
          organizationId,
          ...recorded,
          message,
          tx,
          notify: (id) => others.add(id),
          transcribe: () => {
            pending.transcribe = recorded.messageId;
          },
        }),
    );
    if (!isNew) {
      deps.log({ level: "info", event: "duplicate_message", waMessageId: message.waMessageId });
      continue;
    }
    // Fora da transação: se a fila falhar aqui, a varredura de pendentes manda depois.
    for (const id of [conversationId, ...others]) await deps.afterCommit?.(id);
    const audioId = toTranscribe();
    if (audioId) await deps.onTranscribe?.(audioId);
  }
}
