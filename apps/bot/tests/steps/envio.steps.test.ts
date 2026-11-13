import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { handleFinalFailure } from "../../src/outbound/dead-letter.ts";
import { RetryLater, sendPending, type SendLog } from "../../src/outbound/send.ts";
import { createVaultTokens } from "../../src/outbound/tokens.ts";
import { Chat } from "../support/chat.ts";
import { BotTestDb } from "../support/db.ts";
import { FakeMeta, META_ERRORS } from "../support/fake-meta.ts";

const feature = await loadFeature("../../features/bot/envio.feature", { language: "pt" });

const ORG = "Horizonte";
const TOKEN = "EAAG-token-secreto-da-horizonte";

describeFeature(feature, ({ Background, Scenario, AfterEachScenario }) => {
  let db: BotTestDb;
  let chat: Chat;
  let meta: FakeMeta;
  let contact = "";
  let alerts: string[] = [];
  let logs: SendLog[] = [];
  let outcome: unknown = null;
  let callsBefore = 0;
  let dead: { conversationId: string }[] = [];

  AfterEachScenario(async () => {
    await db.cleanup();
  });

  const run = async () => {
    outcome = null;
    try {
      outcome = await sendPending(db.sql, await db.conversationId(ORG, contact), {
        cloud: meta,
        tokens: createVaultTokens(db.sql, null),
        alert: (text) => {
          alerts.push(text);
          return Promise.resolve();
        },
        log: (entry) => logs.push(entry),
      });
    } catch (e) {
      outcome = e;
    }
  };
  const allSent = async () => {
    const states = await db.sendStates(ORG, contact);
    expect(states.length).toBeGreaterThan(0);
    for (const s of states) {
      expect(s.send_status).toBe("sent");
      expect(s.wa_message_id).toMatch(/^wamid\.OUT-/);
    }
  };
  const stillPending = async () => {
    expect((await db.sendStates(ORG, contact)).map((s) => s.send_status)).toContain("pending");
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com o número do WhatsApp {string} e o token guardado no cofre",
      async (_ctx, org: string, phone: string) => {
        db = new BotTestDb();
        meta = new FakeMeta();
        alerts = [];
        logs = [];
        dead = [];
        await db.org(org, phone);
        await db.vaultToken(org, TOKEN);
        await db.agent(org, "Marina");
        await db.unit(org, "AUR-502", 765_000, "available");
        chat = new Chat(db, org, phone);
      },
    );
    And(
      "o contato {string} mandou {string} e o bot deixou as respostas para enviar",
      async (_ctx, from: string, text: string) => {
        contact = from;
        await chat.type(contact, text);
      },
    );
  });

  Scenario("As respostas saem na ordem em que o bot escreveu", ({ Given, When, Then, And }) => {
    Given("o contato perguntou {string}", async (_ctx, text: string) => {
      await chat.type(contact, text);
    });
    When("o worker de envio roda para a conversa", async () => {
      await run();
      expect(outcome).toEqual({ sent: 3, failed: 0 });
    });
    Then(
      "a Meta recebe {int} mensagens para {string}, na ordem em que o bot escreveu",
      async (_ctx, n: number, to: string) => {
        const written = (await db.outbound(ORG, contact)).map((m) => m.payload);
        expect(meta.calls).toHaveLength(n);
        expect(meta.calls.map((c) => c.payload)).toEqual(written);
        for (const c of meta.calls) expect(c.payload["to"]).toBe(to);
        expect(meta.calls[0]?.phoneNumberId).toBe(await db.phoneNumberId("PHONE_ENVIO"));
      },
    );
    And("todas ficam marcadas como enviadas, com o id que a Meta devolveu", allSent);
  });

  Scenario(
    "O envio usa o token da imobiliária, e o token não aparece em logs nem alertas",
    ({ When, Then, And }) => {
      When("o worker de envio roda para a conversa", run);
      Then("a Meta recebe as mensagens com o token da {string}", () => {
        expect(meta.calls.length).toBeGreaterThan(0);
        for (const c of meta.calls) expect(c.token).toBe(TOKEN);
      });
      And("o token não aparece em nenhum log nem alerta", async () => {
        const errors = (await db.sendStates(ORG, contact)).map((s) => s.send_error ?? "");
        expect(JSON.stringify([logs, alerts, errors])).not.toContain(TOKEN);
      });
    },
  );

  Scenario(
    "Meta pede para esperar (limite de envio) e o envio é tentado de novo",
    ({ Given, When, Then, And }) => {
      Given("a Meta responde {string} na primeira tentativa", (_ctx, error: string) => {
        meta.respondNext(META_ERRORS[error as keyof typeof META_ERRORS]);
      });
      When("o worker de envio roda para a conversa", run);
      Then("o envio é adiado para tentar de novo", () => {
        expect(outcome).toBeInstanceOf(RetryLater);
        expect((outcome as RetryLater).rateLimited).toBe(true);
      });
      And("a resposta continua pendente", stillPending);
      When("o worker de envio roda de novo para a conversa", run);
      Then("todas ficam marcadas como enviadas, com o id que a Meta devolveu", allSent);
    },
  );

  Scenario("Meta fora do ar é tentada de novo sem marcar falha", ({ Given, When, Then, And }) => {
    Given("a Meta responde {string} na primeira tentativa", (_ctx, error: string) => {
      meta.respondNext(META_ERRORS[error as keyof typeof META_ERRORS]);
    });
    When("o worker de envio roda para a conversa", run);
    Then("o envio é adiado para tentar de novo", () => {
      expect(outcome).toBeInstanceOf(RetryLater);
      expect((outcome as RetryLater).rateLimited).toBe(false);
    });
    And("a resposta continua pendente", async () => {
      await stillPending();
      expect((await db.sendStates(ORG, contact)).map((s) => s.send_status)).not.toContain("failed");
    });
  });

  Scenario(
    "Erro definitivo da Meta marca a falha e avisa a operação",
    ({ Given, When, Then, And }) => {
      Given("a Meta responde {string} para a primeira mensagem", (_ctx, error: string) => {
        meta.respondNext(META_ERRORS[error as keyof typeof META_ERRORS]);
      });
      When("o worker de envio roda para a conversa", run);
      Then("a primeira resposta fica marcada como falha com o código da Meta", async () => {
        const [first] = await db.sendStates(ORG, contact);
        expect(first?.send_status).toBe("failed");
        expect(first?.send_error).toMatch(/^131047\b/);
      });
      And("a operação recebe um alerta de falha de envio", () => {
        expect(alerts.join("\n")).toMatch(/Falha no envio/);
      });
      And("não há nova tentativa", () => {
        expect(outcome).not.toBeInstanceOf(Error);
      });
    },
  );

  Scenario("Mensagem já enviada não é enviada de novo", ({ Given, When, Then }) => {
    Given("o worker de envio já rodou para a conversa", async () => {
      await run();
      expect(outcome).toEqual({ sent: 1, failed: 0 });
      callsBefore = meta.calls.length;
      expect(callsBefore).toBeGreaterThan(0);
    });
    When("o worker de envio roda de novo para a conversa", run);
    Then("a Meta não recebe nenhuma mensagem nova", () => {
      expect(meta.calls).toHaveLength(callsBefore);
    });
  });

  Scenario(
    "Envio que esgotou as tentativas vai para a fila de mortos e avisa a operação",
    ({ When, Then, And }) => {
      When("o envio da conversa esgota as tentativas", async () => {
        await handleFinalFailure(
          { conversationId: await db.conversationId(ORG, contact), error: "Something went wrong" },
          {
            dead: {
              add: (job) => {
                dead.push(job);
                return Promise.resolve();
              },
            },
            alert: (text) => {
              alerts.push(text);
              return Promise.resolve();
            },
          },
        );
      });
      Then("o job vai para a fila de mortos", async () => {
        expect(dead).toEqual([{ conversationId: await db.conversationId(ORG, contact) }]);
      });
      And("a operação recebe um alerta de falha de envio", () => {
        expect(alerts.join("\n")).toMatch(/Falha no envio/);
      });
    },
  );

  Scenario(
    "Número sem token configurado não envia e avisa a operação",
    ({ Given, When, Then, And }) => {
      Given("o número da {string} está sem token", async (_ctx, org: string) => {
        await db.removeToken(org);
      });
      When("o worker de envio roda para a conversa", run);
      Then("a Meta não recebe nenhuma mensagem nova", () => {
        expect(meta.calls).toHaveLength(0);
      });
      And("a operação recebe um alerta de falha de envio", () => {
        expect(alerts.join("\n")).toMatch(/Falha no envio.*sem token/s);
      });
      And("a resposta continua pendente", stillPending);
    },
  );
});
