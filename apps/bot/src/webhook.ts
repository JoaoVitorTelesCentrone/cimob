import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { isValidSignature, payloadId } from "./signature.ts";

/** O que vai para a fila `inbound`: o payload bruto da Meta. O worker (T2.2) interpreta. */
export type InboundJob = { id: string; payload: Record<string, unknown>; receivedAt: string };

/** Logs sem conteúdo de mensagem: telefone, nome e texto do lead não saem daqui (LGPD). */
export type WebhookLog =
  | { level: "warn"; event: "invalid_signature" | "invalid_json" | "body_too_large" }
  | { level: "error"; event: "enqueue_failed"; error: string };

export type WebhookDeps = {
  verifyToken: string;
  appSecret: string;
  enqueue: (job: InboundJob) => Promise<void>;
  log?: (entry: WebhookLog) => void;
  now?: () => Date;
};

/** Payloads da Cloud API têm poucos KB; 1 MB cobre lotes grandes com folga. */
export const MAX_BODY_BYTES = 1024 * 1024;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Webhook da Cloud API. Só confere e enfileira: responde em milissegundos e deixa
 * banco, flow e LLM para o worker. Erro ao enfileirar devolve 503 para a Meta reenviar.
 */
export function createWebhookApp(deps: WebhookDeps) {
  const log = deps.log ?? (() => undefined);
  const now = deps.now ?? (() => new Date());
  const app = new Hono();

  app.get("/health", (c) => c.text("ok"));

  app.get("/webhook", (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    if (mode !== "subscribe" || !deps.verifyToken || token !== deps.verifyToken) {
      return c.text("forbidden", 403);
    }
    if (!challenge) return c.text("missing challenge", 400);
    return c.text(challenge);
  });

  // Corta o corpo grande durante a leitura, antes de ocupar memória.
  const limit = bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => {
      log({ level: "warn", event: "body_too_large" });
      return c.text("payload too large", 413);
    },
  });

  app.post("/webhook", limit, async (c) => {
    const raw = await c.req.text();
    if (!isValidSignature(raw, c.req.header("x-hub-signature-256"), deps.appSecret)) {
      log({ level: "warn", event: "invalid_signature" });
      return c.text("invalid signature", 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
    if (!isObject(payload)) {
      log({ level: "warn", event: "invalid_json" });
      return c.text("invalid json", 400);
    }

    try {
      await deps.enqueue({ id: payloadId(raw), payload, receivedAt: now().toISOString() });
    } catch (e) {
      log({
        level: "error",
        event: "enqueue_failed",
        error: e instanceof Error ? e.message : String(e),
      });
      return c.text("try again", 503);
    }
    return c.text("ok");
  });

  return app;
}
