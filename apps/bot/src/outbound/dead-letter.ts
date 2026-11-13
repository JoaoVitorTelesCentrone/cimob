/** Job de envio que esgotou as tentativas. */
export type DeadJob = { conversationId: string };

/**
 * Esgotou as tentativas: guarda o job na fila de mortos (para reenviar à mão depois de resolver)
 * e avisa a operação. As mensagens continuam pendentes no banco; nada é perdido.
 */
export async function handleFinalFailure(
  job: { conversationId: string; error: string },
  deps: { dead: { add(job: DeadJob): Promise<void> }; alert: (text: string) => Promise<void> },
): Promise<void> {
  await deps.dead.add({ conversationId: job.conversationId });
  await deps.alert(
    `Falha no envio: a conversa ${job.conversationId} esgotou as tentativas e foi para a fila de mortos. Último erro: ${job.error}`,
  );
}
