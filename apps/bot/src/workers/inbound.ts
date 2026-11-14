import { Worker } from "bullmq";
import { Redis } from "ioredis";
import type postgres from "postgres";
import { processInbound, type InboundLog, type NewMessage } from "../inbound/process.ts";
import { createPostgresStore } from "../inbound/store.ts";
import { INBOUND_QUEUE } from "../queue.ts";
import type { InboundJob } from "../webhook.ts";

export type InboundWorkerDeps = {
  redisUrl: string;
  sql: postgres.Sql;
  /** O flow da conversa (T2.3). Roda na mesma transação da gravação da mensagem. */
  onMessage: (m: NewMessage) => Promise<void>;
  /** Depois do commit de cada mensagem nova: enfileira o envio das respostas. */
  afterCommit: (conversationId: string) => Promise<void>;
  /** Depois do commit: áudio que o flow mandou transcrever. */
  onTranscribe: (messageId: string) => Promise<void>;
  /** Alerta da operação: falha de entrega avisada pela Meta depois de aceitar. */
  alert: (text: string) => Promise<void>;
  log: (
    entry:
      | InboundLog
      | { level: "error"; event: "inbound_failed"; jobId: string; attempt: number; error: string }
      | { level: "warn"; event: "redis_error"; error: string },
  ) => void;
};

/** Consome a fila `inbound`. Falha sobe para o BullMQ, que tenta de novo (ver opções em queue.ts). */
export function startInboundWorker(deps: InboundWorkerDeps) {
  // Consumidor pode esperar a reconexão (diferente do produtor no webhook, que precisa falhar rápido).
  const connection = new Redis(deps.redisUrl, { maxRetriesPerRequest: null });
  connection.on("error", (e) => {
    deps.log({ level: "warn", event: "redis_error", error: e.message });
  });
  const store = createPostgresStore(deps.sql);

  const worker = new Worker<InboundJob>(
    INBOUND_QUEUE,
    (job) =>
      processInbound(job.data.payload, {
        store,
        onMessage: deps.onMessage,
        log: deps.log,
        afterCommit: deps.afterCommit,
        onTranscribe: deps.onTranscribe,
        alert: deps.alert,
      }),
    { connection, concurrency: 8 },
  );
  worker.on("error", (e) => {
    deps.log({ level: "warn", event: "redis_error", error: e.message });
  });
  worker.on("failed", (job, err) => {
    deps.log({
      level: "error",
      event: "inbound_failed",
      jobId: job?.id ?? "?",
      attempt: job?.attemptsMade ?? 0,
      error: err.message,
    });
  });

  return {
    async close(): Promise<void> {
      await worker.close();
      connection.disconnect();
    },
  };
}
