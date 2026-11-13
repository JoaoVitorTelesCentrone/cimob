import type postgres from "postgres";

const MAX_PER_SWEEP = 200;

/**
 * Conversas com resposta pendente há mais de `olderThanMs`: escaparam do gatilho pós-commit
 * (Redis fora, processo caiu entre o commit e a fila). A varredura devolve para a fila de envio.
 */
export async function stalePendingConversations(
  sql: postgres.Sql,
  olderThanMs: number,
): Promise<string[]> {
  const rows = await sql<{ conversation_id: string }[]>`
    select conversation_id from messages
    where send_status = 'pending'
      and created_at < now() - make_interval(secs => ${olderThanMs / 1000})
    group by conversation_id
    order by min(created_at)
    limit ${MAX_PER_SWEEP}`;
  return rows.map((r) => r.conversation_id);
}
