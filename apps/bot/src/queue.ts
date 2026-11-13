import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { InboundJob } from "./webhook.ts";

export const INBOUND_QUEUE = "inbound";

const DAY_S = 24 * 60 * 60;

/**
 * Fila `inbound` (produtor). `enableOfflineQueue: false`: com o Redis fora, o `add` falha na hora
 * e o webhook responde 503 (a Meta reenvia) em vez de ficar esperando a reconexão.
 */
export function createInboundQueue(redisUrl: string, onError: (error: Error) => void) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
  // Sem tratador, o ioredis joga a pilha do erro no terminal a cada tentativa de reconexão.
  connection.on("error", onError);
  const queue = new Queue<InboundJob>(INBOUND_QUEUE, { connection });

  queue.on("error", onError);

  return {
    async enqueue(job: InboundJob): Promise<void> {
      await queue.add(INBOUND_QUEUE, job, {
        // Mesmo corpo reenviado pela Meta = mesmo jobId: o BullMQ não cria outro.
        // Os concluídos ficam 1 dia para isso valer; a idempotência definitiva é por message_id no banco (T2.2).
        jobId: job.id,
        removeOnComplete: { age: DAY_S },
        removeOnFail: { age: 7 * DAY_S },
        // Banco ou flow fora do ar: tenta de novo com espera crescente (2 s, 4 s, 8 s... até ~4 min).
        attempts: 8,
        backoff: { type: "exponential", delay: 2000 },
      });
    },
    async close(): Promise<void> {
      await queue.close();
      connection.disconnect();
    },
  };
}
