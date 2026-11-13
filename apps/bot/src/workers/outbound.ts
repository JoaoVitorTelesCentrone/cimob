import { DelayedError, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import type postgres from "postgres";
import { createCloudApi } from "../outbound/cloud-api.ts";
import { handleFinalFailure, type DeadJob } from "../outbound/dead-letter.ts";
import { RetryLater, sendPending, type SendLog } from "../outbound/send.ts";
import { stalePendingConversations } from "../outbound/sweep.ts";
import { createVaultTokens } from "../outbound/tokens.ts";

export const OUTBOUND_QUEUE = "outbound";
export const OUTBOUND_DEAD_QUEUE = "outbound-dead";

const DAY_S = 24 * 60 * 60;
const ATTEMPTS = 8;
/** Abaixo do limite padrão da Meta (80 mensagens/s por número). */
const MAX_PER_SECOND = 50;
const RATE_LIMIT_PAUSE_MS = 2_000;
const LOCKED_RETRY_MS = 500;
const SWEEP_EVERY_MS = 30_000;

type OutboundJob = { conversationId: string };

export type OutboundLog =
  | SendLog
  | { level: "error"; event: "outbound_job_failed"; jobId: string; attempt: number; error: string }
  | { level: "warn"; event: "enqueue_outbound_failed"; error: string }
  | { level: "warn"; event: "redis_error"; error: string };

export type OutboundDeps = {
  redisUrl: string;
  sql: postgres.Sql;
  graphApiVersion: string;
  graphApiBaseUrl: string;
  fallbackToken: string | null;
  alert: (text: string) => Promise<void>;
  log: (entry: OutboundLog) => void;
};

/**
 * Fila e worker de envio (doc 04): um job por conversa manda as pendentes em ordem.
 * - Meta pediu para esperar: pausa a fila inteira um pouco, sem gastar tentativa.
 * - Outro worker já enviando a conversa: adia meio segundo, sem gastar tentativa.
 * - Meta fora do ar: gasta tentativa, com espera crescente; esgotou → fila de mortos + alerta.
 * - Varredura a cada 30 s pega o que escapou do gatilho pós-commit.
 */
export function startOutbound(deps: OutboundDeps) {
  const producer = new Redis(deps.redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });
  const consumer = new Redis(deps.redisUrl, { maxRetriesPerRequest: null });
  for (const conn of [producer, consumer]) {
    conn.on("error", (e) => {
      deps.log({ level: "warn", event: "redis_error", error: e.message });
    });
  }
  const queue = new Queue<OutboundJob>(OUTBOUND_QUEUE, { connection: producer });
  const dead = new Queue<DeadJob>(OUTBOUND_DEAD_QUEUE, { connection: producer });
  const sendDeps = {
    cloud: createCloudApi({ version: deps.graphApiVersion, baseUrl: deps.graphApiBaseUrl }),
    tokens: createVaultTokens(deps.sql, deps.fallbackToken),
    alert: deps.alert,
    log: deps.log,
  };

  const enqueue = async (conversationId: string): Promise<void> => {
    await queue.add(
      OUTBOUND_QUEUE,
      { conversationId },
      {
        attempts: ATTEMPTS,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: DAY_S },
        removeOnFail: { age: 7 * DAY_S },
      },
    );
  };

  const worker: Worker<OutboundJob> = new Worker<OutboundJob>(
    OUTBOUND_QUEUE,
    async (job, token) => {
      try {
        await sendPending(deps.sql, job.data.conversationId, sendDeps);
      } catch (e) {
        if (!(e instanceof RetryLater)) throw e;
        if (e.reason === "rate_limited") {
          await queue.rateLimit(RATE_LIMIT_PAUSE_MS);
          throw Worker.RateLimitError();
        }
        if (e.reason === "locked") {
          await job.moveToDelayed(Date.now() + LOCKED_RETRY_MS, token);
          throw new DelayedError();
        }
        throw e;
      }
    },
    { connection: consumer, concurrency: 8, limiter: { max: MAX_PER_SECOND, duration: 1000 } },
  );

  const onRedisError = (e: Error) => {
    deps.log({ level: "warn", event: "redis_error", error: e.message });
  };
  queue.on("error", onRedisError);
  dead.on("error", onRedisError);
  worker.on("error", onRedisError);
  worker.on("failed", (job, err) => {
    if (!job) return;
    deps.log({
      level: "error",
      event: "outbound_job_failed",
      jobId: job.id ?? "?",
      attempt: job.attemptsMade,
      error: err.message,
    });
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void handleFinalFailure(
        { conversationId: job.data.conversationId, error: err.message },
        {
          dead: {
            add: async (d) => {
              await dead.add(OUTBOUND_DEAD_QUEUE, d);
            },
          },
          alert: deps.alert,
        },
      );
    }
  });

  const sweep = setInterval(() => {
    void stalePendingConversations(deps.sql, SWEEP_EVERY_MS)
      .then((ids) => Promise.all(ids.map(enqueue)))
      .catch((e: unknown) => {
        deps.log({
          level: "warn",
          event: "enqueue_outbound_failed",
          error: e instanceof Error ? e.message : String(e),
        });
      });
  }, SWEEP_EVERY_MS);

  return {
    /** Gatilho pós-commit. Falha aqui não derruba a entrada: a varredura manda depois. */
    async notify(conversationId: string): Promise<void> {
      try {
        await enqueue(conversationId);
      } catch (e) {
        deps.log({
          level: "warn",
          event: "enqueue_outbound_failed",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    async close(): Promise<void> {
      clearInterval(sweep);
      await worker.close();
      await queue.close();
      await dead.close();
      producer.disconnect();
      consumer.disconnect();
    },
  };
}
