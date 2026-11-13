import { createHmac } from "node:crypto";
import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { processInbound } from "../../src/inbound/process.ts";
import { createPostgresStore } from "../../src/inbound/store.ts";
import { createWebhookApp, type InboundJob } from "../../src/webhook.ts";
import { BotTestDb } from "../support/db.ts";
import { textMessage } from "../support/payloads.ts";

const feature = await loadFeature("../../features/bot/webhook.feature", { language: "pt" });

/** Payload no formato da Cloud API (uma mensagem de texto). */
const MESSAGE = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA_ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "5511999990000", phone_number_id: "PHONE_ID" },
            contacts: [{ profile: { name: "Ana" }, wa_id: "5511987654321" }],
            messages: [
              {
                from: "5511987654321",
                id: "wamid.ABC123",
                timestamp: "1763000000",
                type: "text",
                text: { body: "Olá! Código: AUR-502" },
              },
            ],
          },
        },
      ],
    },
  ],
});

describeFeature(
  feature,
  ({ Background, Scenario, AfterEachScenario }) => {
    let secret = "";
    let token = "";
    let queued: InboundJob[] = [];
    let queueDown = false;
    let slowConsumer = false;
    let response: Response;
    let elapsedMs = 0;

    const app = () =>
      createWebhookApp({
        verifyToken: token,
        appSecret: secret,
        enqueue: (job) => {
          if (queueDown) return Promise.reject(new Error("Redis fora do ar"));
          // Dedup por id, como o BullMQ faz com jobId.
          if (!queued.some((q) => q.id === job.id)) queued.push(job);
          // O consumidor (worker + LLM) roda depois; o webhook não espera por ele.
          if (slowConsumer) setTimeout(() => undefined, 10_000).unref();
          return Promise.resolve();
        },
      });
    const sign = (body: string, key = secret) =>
      `sha256=${createHmac("sha256", key).update(body).digest("hex")}`;
    const post = async (body: string, signature?: string) => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (signature) headers["x-hub-signature-256"] = signature;
      const started = performance.now();
      response = await app().request("/webhook", { method: "POST", body, headers });
      elapsedMs = performance.now() - started;
    };
    const verify = async (verifyToken: string, challenge: string) => {
      const qs = new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.verify_token": verifyToken,
        "hub.challenge": challenge,
      });
      response = await app().request(`/webhook?${qs.toString()}`);
    };

    let db: BotTestDb | null = null;
    let replies = 0;

    AfterEachScenario(async () => {
      await db?.cleanup();
      db = null;
    });

    Background(({ Given }) => {
      Given(
        "o webhook configurado com o token de verificação {string} e o segredo do app {string}",
        (_ctx, verifyToken: string, appSecret: string) => {
          token = verifyToken;
          secret = appSecret;
          queued = [];
          queueDown = false;
          slowConsumer = false;
        },
      );
    });

    Scenario("A Meta verifica o webhook com o token certo", ({ When, Then }) => {
      When(
        "a Meta pede a verificação com o token {string} e o desafio {string}",
        async (_ctx, t: string, challenge: string) => {
          await verify(t, challenge);
        },
      );
      Then(
        "a resposta é {int} com o corpo {string}",
        async (_ctx, status: number, body: string) => {
          expect(response.status).toBe(status);
          expect(await response.text()).toBe(body);
        },
      );
    });

    Scenario("Verificação com token errado é recusada", ({ When, Then }) => {
      When(
        "a Meta pede a verificação com o token {string} e o desafio {string}",
        async (_ctx, t: string, challenge: string) => {
          await verify(t, challenge);
        },
      );
      Then("a resposta é {int}", (_ctx, status: number) => {
        expect(response.status).toBe(status);
      });
    });

    Scenario("Mensagem com assinatura válida é enfileirada", ({ When, Then, And }) => {
      When("chega uma mensagem válida", async () => {
        await post(MESSAGE, sign(MESSAGE));
      });
      Then("a resposta é {int}", (_ctx, status: number) => {
        expect(response.status).toBe(status);
      });
      And("o payload bruto é enfileirado em {string} uma vez", (_ctx, queue: string) => {
        expect(queue).toBe("inbound");
        expect(queued).toHaveLength(1);
        expect(queued[0]?.payload).toEqual(JSON.parse(MESSAGE));
      });
    });

    Scenario("Assinatura inválida é recusada", ({ When, Then, And }) => {
      When("chega um POST no webhook com assinatura inválida", async () => {
        await post(MESSAGE, sign(MESSAGE, "outro-segredo"));
      });
      Then("a resposta é {int}", (_ctx, status: number) => {
        expect(response.status).toBe(status);
      });
      And("nada é enfileirado", () => {
        expect(queued).toHaveLength(0);
      });
    });

    Scenario("POST sem assinatura é recusado", ({ When, Then, And }) => {
      When("chega um POST no webhook sem assinatura", async () => {
        await post(MESSAGE);
      });
      Then("a resposta é {int}", (_ctx, status: number) => {
        expect(response.status).toBe(status);
      });
      And("nada é enfileirado", () => {
        expect(queued).toHaveLength(0);
      });
    });

    Scenario("Corpo que não é JSON é recusado mesmo assinado", ({ When, Then, And }) => {
      When("chega um POST assinado com o corpo {string}", async (_ctx, body: string) => {
        await post(body, sign(body));
      });
      Then("a resposta é {int}", (_ctx, status: number) => {
        expect(response.status).toBe(status);
      });
      And("nada é enfileirado", () => {
        expect(queued).toHaveLength(0);
      });
    });

    Scenario("A mesma entrega repetida pela Meta é enfileirada uma vez só", ({ When, Then }) => {
      When("a mesma mensagem válida chega {int} vezes", async (_ctx, times: number) => {
        for (let i = 0; i < times; i++) await post(MESSAGE, sign(MESSAGE));
      });
      Then("o payload bruto é enfileirado em {string} uma vez", (_ctx, queue: string) => {
        expect(queue).toBe("inbound");
        expect(queued).toHaveLength(1);
      });
    });

    Scenario("Webhook responde rápido mesmo com o LLM lento", ({ Given, When, Then }) => {
      Given("o LLM leva {int} segundos para responder", () => {
        slowConsumer = true;
      });
      When("chega uma mensagem válida", async () => {
        await post(MESSAGE, sign(MESSAGE));
      });
      Then(
        "o webhook responde {int} em menos de {int} segundo",
        (_ctx, status: number, seconds: number) => {
          expect(response.status).toBe(status);
          expect(elapsedMs).toBeLessThan(seconds * 1000);
        },
      );
    });

    Scenario("Fila fora do ar faz a Meta tentar de novo", ({ Given, When, Then }) => {
      Given("a fila está fora do ar", () => {
        queueDown = true;
      });
      When("chega uma mensagem válida", async () => {
        await post(MESSAGE, sign(MESSAGE));
      });
      Then("a resposta é {int}", (_ctx, status: number) => {
        expect(response.status).toBe(status);
      });
    });

    Scenario("Mensagem duplicada gera uma resposta só", ({ Given, When, Then, And }) => {
      /** Passa pelo webhook e o worker processa o que foi enfileirado (o "bot" responde contando). */
      const deliver = async (payload: Record<string, unknown>) => {
        const body = JSON.stringify(payload);
        await post(body, sign(body));
        const testDb = db;
        if (!testDb) throw new Error("banco de teste não iniciado");
        for (const job of queued.splice(0)) {
          await processInbound(job.payload, {
            store: createPostgresStore(testDb.sql),
            onMessage: () => {
              replies += 1;
              return Promise.resolve();
            },
            log: () => undefined,
          });
        }
      };

      Given("o webhook recebeu a mensagem {string}", async (_ctx, id: string) => {
        db = new BotTestDb();
        replies = 0;
        await db.org("Horizonte", "PHONE_DUP");
        await deliver(
          textMessage(db.wamid(id), "5511987654321", await db.phoneNumberId("PHONE_DUP"), "Oi"),
        );
      });
      When("o webhook recebe de novo a mensagem {string}", async (_ctx, id: string) => {
        // Reentrega com o envelope diferente (outro corpo, outro jobId): só o banco segura.
        const again = textMessage(
          (db as BotTestDb).wamid(id),
          "5511987654321",
          await (db as BotTestDb).phoneNumberId("PHONE_DUP"),
          "Oi",
        );
        await deliver({ ...again, retried: true });
      });
      Then("apenas uma resposta é enviada ao contato", () => {
        expect(replies).toBe(1);
      });
      And("existe apenas uma mensagem {string} gravada", async (_ctx, id: string) => {
        const testDb = db as BotTestDb;
        const rows =
          await testDb.sql`select 1 from messages where wa_message_id = ${testDb.wamid(id)}`;
        expect(rows).toHaveLength(1);
      });
    });
  },
  { excludeTags: ["wip"] },
);
