import type postgres from "postgres";
import { classify, type CloudApi } from "./cloud-api.ts";
import type { TokenSource } from "./tokens.ts";

/**
 * Envio adiado; a fila tenta de novo. Motivos: a Meta pediu para esperar (`rate_limited`),
 * a Meta ou a rede falharam (`retry`), ou outro worker já está enviando a conversa (`locked`).
 */
export class RetryLater extends Error {
  // Campo declarado à parte: o Node roda este arquivo só removendo tipos (sem parameter properties).
  readonly reason: "rate_limited" | "retry" | "locked";

  constructor(message: string, reason: "rate_limited" | "retry" | "locked") {
    super(message);
    this.name = "RetryLater";
    this.reason = reason;
  }

  get rateLimited(): boolean {
    return this.reason === "rate_limited";
  }
}

/** Logs sem texto, telefone nem token. */
export type SendLog =
  | { level: "info"; event: "outbound_sent"; conversationId: string; count: number }
  | { level: "warn"; event: "outbound_failed"; conversationId: string; code: number | null };

export type SendDeps = {
  cloud: CloudApi;
  tokens: TokenSource;
  alert: (text: string) => Promise<void>;
  log: (entry: SendLog) => void;
};

export type SendReport = { sent: number; failed: number };

/** Chave da trava por conversa: dois envios simultâneos para o mesmo contato embaralhariam a ordem. */
const lockKey = (conversationId: string) => `outbound:${conversationId}`;

/**
 * Manda as mensagens pendentes de uma conversa, em ordem, pelo número com que o contato falou.
 * Cada mensagem é marcada logo depois de sair (sem transação longa): se o processo cair no meio,
 * o que já saiu não sai de novo.
 */
export async function sendPending(
  sql: postgres.Sql,
  conversationId: string,
  deps: SendDeps,
): Promise<SendReport> {
  const conn = await sql.reserve();
  try {
    const [lock] = await conn<{ ok: boolean }[]>`
      select pg_try_advisory_lock(hashtext(${lockKey(conversationId)})) as ok`;
    if (!lock?.ok) throw new RetryLater("conversa já está sendo enviada", "locked");
    try {
      return await sendLocked(conn, conversationId, deps);
    } finally {
      await conn`select pg_advisory_unlock(hashtext(${lockKey(conversationId)}))`;
    }
  } finally {
    conn.release();
  }
}

async function sendLocked(
  conn: postgres.ReservedSql,
  conversationId: string,
  deps: SendDeps,
): Promise<SendReport> {
  const [conv] = await conn<{ phone_number_id: string | null; org_name: string }[]>`
    select c.phone_number_id, o.name as org_name
    from conversations c join organizations o on o.id = c.organization_id
    where c.id = ${conversationId}`;
  const pending = await conn<{ id: string; payload: Record<string, unknown> }[]>`
    select id, payload from messages
    where conversation_id = ${conversationId} and send_status = 'pending'
    order by created_at`;
  if (!conv || pending.length === 0) return { sent: 0, failed: 0 };

  const token = conv.phone_number_id ? await deps.tokens.get(conv.phone_number_id) : null;
  if (!conv.phone_number_id || !token) {
    // Fica pendente: quando o token for configurado, a varredura manda.
    await deps.alert(
      `Falha no envio (${conv.org_name}): número sem token configurado. ${String(pending.length)} mensagem(ns) aguardando.`,
    );
    return { sent: 0, failed: 0 };
  }

  const report: SendReport = { sent: 0, failed: 0 };
  const failures: string[] = [];
  for (const message of pending) {
    const result = await deps.cloud.send(conv.phone_number_id, token, message.payload);
    if (result.ok) {
      await conn`update messages set send_status = 'sent', sent_at = now(), wa_message_id = ${result.waMessageId}
                 where id = ${message.id}`;
      report.sent += 1;
      continue;
    }
    const kind = classify(result);
    if (kind !== "permanent") {
      // Para aqui para não furar a ordem; as próximas saem na nova tentativa.
      throw new RetryLater(`${String(result.code ?? result.status)}: ${result.message}`, kind);
    }
    const error = `${String(result.code ?? result.status)}: ${result.message}`;
    await conn`update messages set send_status = 'failed', send_error = ${error} where id = ${message.id}`;
    deps.log({ level: "warn", event: "outbound_failed", conversationId, code: result.code });
    failures.push(error);
    report.failed += 1;
  }

  if (failures.length > 0) {
    await deps.alert(
      `Falha no envio (${conv.org_name}): ${String(failures.length)} mensagem(ns) recusada(s) pela Meta. ${failures[0] ?? ""}`,
    );
  }
  if (report.sent > 0) {
    deps.log({ level: "info", event: "outbound_sent", conversationId, count: report.sent });
  }
  return report;
}
