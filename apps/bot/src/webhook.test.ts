import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWebhookApp, MAX_BODY_BYTES, type InboundJob, type WebhookLog } from "./webhook.ts";

const secret = "segredo-app";
const sign = (b: string) => `sha256=${createHmac("sha256", secret).update(b).digest("hex")}`;

function setup() {
  const jobs: InboundJob[] = [];
  const logs: WebhookLog[] = [];
  const app = createWebhookApp({
    verifyToken: "tok",
    appSecret: secret,
    enqueue: (job) => {
      jobs.push(job);
      return Promise.resolve();
    },
    log: (entry) => logs.push(entry),
    now: () => new Date("2026-11-13T12:00:00Z"),
  });
  const post = (body: string, signature = sign(body)) =>
    app.request("/webhook", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-hub-signature-256": signature },
    });
  return { app, jobs, logs, post };
}

describe("GET /webhook", () => {
  it("exige hub.mode=subscribe", async () => {
    const { app } = setup();
    const res = await app.request(
      "/webhook?hub.mode=unsubscribe&hub.verify_token=tok&hub.challenge=1",
    );
    expect(res.status).toBe(403);
  });

  it("sem desafio é 400", async () => {
    const { app } = setup();
    const res = await app.request("/webhook?hub.mode=subscribe&hub.verify_token=tok");
    expect(res.status).toBe(400);
  });

  it("devolve o desafio como texto puro", async () => {
    const { app } = setup();
    const res = await app.request(
      "/webhook?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=42",
    );
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await res.text()).toBe("42");
  });
});

describe("POST /webhook", () => {
  it("o job leva o id da entrega, o payload e a hora de chegada", async () => {
    const { jobs, post } = setup();
    await post('{"object":"whatsapp_business_account"}');
    expect(jobs[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
      payload: { object: "whatsapp_business_account" },
      receivedAt: "2026-11-13T12:00:00.000Z",
    });
  });

  it("corpo grande demais é 413 e não é enfileirado", async () => {
    const { jobs, post } = setup();
    const big = JSON.stringify({ x: "a".repeat(MAX_BODY_BYTES) });
    const res = await post(big);
    expect(res.status).toBe(413);
    expect(jobs).toHaveLength(0);
  });

  it("JSON que não é objeto é 400", async () => {
    const { jobs, post } = setup();
    expect((await post("[1,2]")).status).toBe(400);
    expect((await post("null")).status).toBe(400);
    expect(jobs).toHaveLength(0);
  });

  it("registra recusas e falhas sem o conteúdo da mensagem (LGPD)", async () => {
    const { logs, post } = setup();
    await post('{"text":"meu cpf é 123"}', "sha256=" + "0".repeat(64));
    expect(logs).toEqual([{ level: "warn", event: "invalid_signature" }]);
    expect(JSON.stringify(logs)).not.toContain("cpf");
  });

  it("falha da fila é 503 e é registrada", async () => {
    const logs: WebhookLog[] = [];
    const app = createWebhookApp({
      verifyToken: "tok",
      appSecret: secret,
      enqueue: () => Promise.reject(new Error("ECONNREFUSED")),
      log: (e) => logs.push(e),
    });
    const body = "{}";
    const res = await app.request("/webhook", {
      method: "POST",
      body,
      headers: { "x-hub-signature-256": sign(body) },
    });
    expect(res.status).toBe(503);
    expect(logs).toEqual([{ level: "error", event: "enqueue_failed", error: "ECONNREFUSED" }]);
  });
});

describe("outras rotas", () => {
  it("GET /health responde ok (para o Docker e o Caddy)", async () => {
    const { app } = setup();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("rota desconhecida é 404", async () => {
    const { app } = setup();
    expect((await app.request("/admin")).status).toBe(404);
  });
});
