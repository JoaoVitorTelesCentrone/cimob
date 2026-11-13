import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import type postgres from "postgres";
import { createMediaDownloader } from "../audio/media.ts";
import { processAudio } from "../audio/process.ts";
import { createTranscriber } from "../audio/transcribe-client.ts";
import type { NewMessage } from "../inbound/process.ts";
import type { TokenSource } from "../outbound/tokens.ts";

export const TRANSCRIBE_QUEUE = "transcribe";
const DAY_S = 24 * 60 * 60;

type TranscribeJob = { messageId: string };

export type TranscribeLog =
  | { level: "error"; event: "transcribe_failed"; jobId: string; error: string }
  | { level: "warn"; event: "redis_error"; error: string };

/**
 * Fila e worker de transcrição (doc 04). Um áudio por vez: o serviço usa o CPU inteiro.
 * Falhas de download e de transcrição já viram "pode escrever?" + alerta dentro do processAudio;
 * aqui só sobem erros de banco, que a fila tenta de novo.
 */
export function startTranscribe(deps: {
  redisUrl: string;
  sql: postgres.Sql;
  transcribeUrl: string | null;
  graphApiVersion: string;
  graphApiBaseUrl: string;
  tokens: TokenSource;
  flow: (m: NewMessage) => Promise<void>;
  alert: (text: string) => Promise<void>;
  afterCommit: (conversationId: string) => Promise<void>;
  log: (entry: TranscribeLog) => void;
}) {
  const onRedisError = (e: Error) => {
    deps.log({ level: "warn", event: "redis_error", error: e.message });
  };
  const producer = new Redis(deps.redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });
  const consumer = new Redis(deps.redisUrl, { maxRetriesPerRequest: null });
  producer.on("error", onRedisError);
  consumer.on("error", onRedisError);
  const queue = new Queue<TranscribeJob>(TRANSCRIBE_QUEUE, { connection: producer });
  queue.on("error", onRedisError);

  const audioDeps = {
    media: createMediaDownloader({ version: deps.graphApiVersion, baseUrl: deps.graphApiBaseUrl }),
    transcriber: createTranscriber({ url: deps.transcribeUrl }),
    tokens: deps.tokens,
    flow: deps.flow,
    alert: deps.alert,
    afterCommit: deps.afterCommit,
  };
  const worker = new Worker<TranscribeJob>(
    TRANSCRIBE_QUEUE,
    (job) => processAudio(deps.sql, job.data.messageId, audioDeps),
    { connection: consumer, concurrency: 1 },
  );
  worker.on("error", onRedisError);
  worker.on("failed", (job, err) => {
    deps.log({
      level: "error",
      event: "transcribe_failed",
      jobId: job?.id ?? "?",
      error: err.message,
    });
  });

  return {
    async enqueue(messageId: string): Promise<void> {
      await queue.add(
        TRANSCRIBE_QUEUE,
        { messageId },
        {
          jobId: messageId,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: DAY_S },
          removeOnFail: { age: 7 * DAY_S },
        },
      );
    },
    async close(): Promise<void> {
      await worker.close();
      await queue.close();
      producer.disconnect();
      consumer.disconnect();
    },
  };
}
