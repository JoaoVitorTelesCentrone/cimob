import { serve } from "@hono/node-server";
import { createOpenRouterExtractor } from "@c1imob/ai";
import { pino } from "pino";
import postgres from "postgres";
import { loadConfig } from "./config.ts";
import { runFollowUps } from "./agent/followup.ts";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { importAdSpend } from "./ads/import.ts";
import { createMarketingApi } from "./ads/marketing-api.ts";
import { createAlerter } from "./alerts.ts";
import { initSentry } from "./sentry.ts";
import { createFlowHandler } from "./flow/runner.ts";
import { createInboundQueue } from "./queue.ts";
import { createWebhookApp } from "./webhook.ts";
import { startInboundWorker } from "./workers/inbound.ts";
import { startOutbound } from "./workers/outbound.ts";
import { createVaultTokens } from "./outbound/tokens.ts";
import { startTranscribe, TRANSCRIBE_QUEUE } from "./workers/transcribe.ts";
import { bullProbe, createWatchdog } from "./watchdog.ts";
import { INBOUND_QUEUE } from "./queue.ts";
import { OUTBOUND_QUEUE } from "./workers/outbound.ts";

const config = loadConfig(process.env);
const logger = pino({ level: config.logLevel });
// Sentry (opcional): erros não tratados e alertas da operação, sem dado pessoal (LGPD).
const sentry = initSentry(config.sentry);
logger.info({ event: "sentry", enabled: Boolean(sentry) });
const inbound = createInboundQueue(config.redisUrl, (e) => {
  logger.warn({ event: "redis_error", error: e.message });
});
const sql = postgres(config.databaseUrl, { max: 10, onnotice: () => undefined });

// Sem chave do OpenRouter o bot segue só com botões e palavras-chave (sem custo de LLM).
const extractor = config.llm
  ? createOpenRouterExtractor({
      apiKey: config.llm.apiKey,
      ...(config.llm.model ? { modelId: config.llm.model } : {}),
    })
  : undefined;
logger.info({ event: "llm", enabled: Boolean(extractor) });

const alert = createAlerter({
  telegram: config.telegram,
  log: (entry) => {
    const { level, ...rest } = entry;
    logger[level](rest);
    if (entry.event === "alert") sentry?.alert(entry.text);
  },
});

const outbound = startOutbound({
  redisUrl: config.redisUrl,
  sql,
  graphApiVersion: config.graphApiVersion,
  graphApiBaseUrl: config.graphApiBaseUrl,
  fallbackToken: config.fallbackToken,
  alert,
  log: ({ level, ...rest }) => {
    logger[level](rest);
  },
});

const flow = createFlowHandler(extractor ? { extractor } : {});

const transcribe = startTranscribe({
  redisUrl: config.redisUrl,
  sql,
  transcribeUrl: config.transcribeUrl,
  graphApiVersion: config.graphApiVersion,
  graphApiBaseUrl: config.graphApiBaseUrl,
  tokens: createVaultTokens(sql, config.fallbackToken),
  flow,
  alert,
  afterCommit: (conversationId) => outbound.notify(conversationId),
  log: ({ level, ...rest }) => {
    logger[level](rest);
  },
});
logger.info({ event: "transcribe", enabled: Boolean(config.transcribeUrl) });

// Por enquanto webhook e worker no mesmo processo (um contêiner no Hetzner). Separar é só subir dois.
const worker = startInboundWorker({
  redisUrl: config.redisUrl,
  sql,
  // Flow da conversa: grava as respostas como mensagens de saída (o envio é o worker outbound, T2.6).
  onMessage: flow,
  afterCommit: (conversationId) => outbound.notify(conversationId),
  onTranscribe: (messageId) => transcribe.enqueue(messageId),
  alert,
  log: ({ level, ...rest }) => {
    logger[level](rest);
  },
});

const app = createWebhookApp({
  verifyToken: config.verifyToken,
  appSecret: config.appSecret,
  enqueue: (job) => inbound.enqueue(job),
  log: ({ level, ...rest }) => {
    logger[level](rest);
  },
});

// Pergunta de estágio ao corretor 24 h depois da passagem (doc 04), conferida a cada 5 min.
const FOLLOW_UP_EVERY_MS = 5 * 60_000;
const followUps = setInterval(() => {
  void runFollowUps(sql)
    .then((ids) => Promise.all(ids.map((id) => outbound.notify(id))))
    .catch((e: unknown) => {
      logger.warn({ event: "follow_up_failed", error: e instanceof Error ? e.message : String(e) });
    });
}, FOLLOW_UP_EVERY_MS);

// Gasto da Meta (T4.1): na subida e a cada 6 h, regravando os últimos 7 dias de cada conta.
const AD_SPEND_EVERY_MS = 6 * 60 * 60_000;
const marketing = createMarketingApi({
  version: config.graphApiVersion,
  baseUrl: config.graphApiBaseUrl,
});
const runAdSpend = () =>
  importAdSpend({
    sql,
    api: marketing,
    fallbackToken: config.adsToken,
    alert,
    log: ({ level, ...rest }) => {
      logger[level](rest);
    },
  }).catch((e: unknown) => {
    logger.warn({
      event: "ad_spend_run_failed",
      error: e instanceof Error ? e.message : String(e),
    });
  });
void runAdSpend();
const adSpend = setInterval(() => void runAdSpend(), AD_SPEND_EVERY_MS);

// Vigia das filas (doc 02): a cada minuto, mensagem parada > 60 s, falha nova ou Redis fora viram alerta.
const WATCH_EVERY_MS = 60_000;
const watchRedis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
watchRedis.on("error", () => undefined); // o vigia avisa "Redis fora do ar" pelo alerta
const watched = [INBOUND_QUEUE, OUTBOUND_QUEUE, TRANSCRIBE_QUEUE].map(
  (name) => [name, new Queue(name, { connection: watchRedis })] as const,
);
const watchdog = createWatchdog({
  probes: watched.map(([name, queue]) => bullProbe(name, queue)),
  alert,
});
const watch = setInterval(() => {
  void watchdog.check(Date.now()).catch((e: unknown) => {
    logger.warn({ event: "watchdog_failed", error: e instanceof Error ? e.message : String(e) });
  });
}, WATCH_EVERY_MS);

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info({ event: "listening", port: info.port });
});

/** Docker manda SIGTERM no deploy: para de aceitar conexões e fecha a fila antes de sair. */
async function shutdown(signal: string) {
  logger.info({ event: "shutdown", signal });
  clearInterval(followUps);
  clearInterval(adSpend);
  clearInterval(watch);
  await Promise.all(watched.map(([, q]) => q.close()));
  watchRedis.disconnect();
  server.close();
  await worker.close();
  await outbound.close();
  await transcribe.close();
  await inbound.close();
  await sql.end();
  await sentry?.flush();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
