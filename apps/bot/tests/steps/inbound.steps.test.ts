import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { processInbound } from "../../src/inbound/process.ts";
import { createPostgresStore } from "../../src/inbound/store.ts";
import { BotTestDb } from "../support/db.ts";
import { audioMessage, buttonReply, readStatus, textMessage } from "../support/payloads.ts";

const feature = await loadFeature("../../features/bot/inbound.feature", { language: "pt" });

describeFeature(feature, ({ Background, Scenario, AfterEachScenario }) => {
  let db: BotTestDb;
  let botCalls = 0;
  let failure: unknown = null;
  let failNext = false;
  let lastPayload: Record<string, unknown> = {};

  AfterEachScenario(async () => {
    await db.cleanup();
  });

  const process = async (payload: Record<string, unknown>) => {
    lastPayload = payload;
    try {
      await processInbound(payload, {
        store: createPostgresStore(db.sql),
        onMessage: () => {
          if (failNext) {
            failNext = false;
            return Promise.reject(new Error("flow quebrou"));
          }
          botCalls += 1;
          return Promise.resolve();
        },
        log: () => undefined,
      });
    } catch (e) {
      failure = e;
    }
  };
  const text = async (id: string, from: string, to: string, body: string) => {
    await process(
      textMessage(
        db.wamid(id),
        from,
        to.startsWith("PHONE_DESCONHECIDO") ? to : await db.phoneNumberId(to),
        body,
      ),
    );
  };

  Background(({ Given }) => {
    Given(
      "a imobiliária {string} com o número do WhatsApp {string}",
      async (_ctx, org: string, phone: string) => {
        db = new BotTestDb();
        botCalls = 0;
        failure = null;
        failNext = false;
        await db.org(org, phone);
      },
    );
  });

  Scenario(
    "Mensagem nova é gravada na conversa do contato e aciona o bot",
    ({ When, Then, And }) => {
      When(
        "chega a mensagem {string} de {string} para {string} com o texto {string}",
        async (_ctx, id: string, from: string, to: string, body: string) => {
          await text(id, from, to, body);
        },
      );
      Then(
        "a conversa de {string} na {string} tem a mensagem recebida {string}",
        async (_ctx, contact: string, org: string, body: string) => {
          expect(await db.messages(org, contact)).toEqual([
            { type: "text", body, direction: "inbound" },
          ]);
        },
      );
      And("o bot é acionado {int} vez", (_ctx, n: number) => {
        expect(botCalls).toBe(n);
      });
    },
  );

  Scenario(
    "A mesma mensagem processada duas vezes ao mesmo tempo é gravada e tratada uma vez",
    ({ When, Then, And }) => {
      When(
        "a mensagem {string} de {string} para {string} é processada {int} vezes ao mesmo tempo",
        async (_ctx, id: string, from: string, to: string, times: number) => {
          const payload = textMessage(db.wamid(id), from, await db.phoneNumberId(to), "Olá");
          await Promise.all(Array.from({ length: times }, () => process(payload)));
        },
      );
      Then(
        "a conversa de {string} na {string} tem {int} mensagem",
        async (_ctx, contact: string, org: string, n: number) => {
          expect(await db.messages(org, contact)).toHaveLength(n);
          expect(failure).toBeNull();
        },
      );
      And("o bot é acionado {int} vez", (_ctx, n: number) => {
        expect(botCalls).toBe(n);
      });
    },
  );

  Scenario(
    "Número que não é de nenhuma imobiliária é descartado sem nova tentativa",
    ({ When, Then, And }) => {
      When(
        "chega a mensagem {string} de {string} para {string} com o texto {string}",
        async (_ctx, id: string, from: string, to: string, body: string) => {
          await text(id, from, to, body);
        },
      );
      Then("nenhuma mensagem é gravada", async () => {
        expect(await db.countMessages()).toBe(0);
      });
      And("o processamento termina sem erro", () => {
        expect(failure).toBeNull();
        expect(botCalls).toBe(0);
      });
    },
  );

  Scenario(
    "O mesmo contato em duas imobiliárias tem conversas separadas",
    ({ Given, When, And, Then }) => {
      Given(
        "a imobiliária {string} com o número do WhatsApp {string}",
        async (_ctx, org: string, phone: string) => {
          await db.org(org, phone);
        },
      );
      When(
        "chega a mensagem {string} de {string} para {string} com o texto {string}",
        async (_ctx, id: string, from: string, to: string, body: string) => {
          await text(id, from, to, body);
        },
      );
      And(
        "chega a mensagem {string} de {string} para {string} com o texto {string}",
        async (_ctx, id: string, from: string, to: string, body: string) => {
          await text(id, from, to, body);
        },
      );
      Then(
        "a conversa de {string} na {string} tem a mensagem recebida {string}",
        async (_ctx, contact: string, org: string, body: string) => {
          expect((await db.messages(org, contact)).map((m) => m.body)).toEqual([body]);
        },
      );
      And(
        "a conversa de {string} na {string} tem a mensagem recebida {string}",
        async (_ctx, contact: string, org: string, body: string) => {
          expect((await db.messages(org, contact)).map((m) => m.body)).toEqual([body]);
        },
      );
    },
  );

  Scenario("Resposta de botão é gravada com o título que o contato viu", ({ When, Then }) => {
    When(
      "chega a resposta de botão {string} de {string} para {string} com o título {string} e o id {string}",
      async (_ctx, id: string, from: string, to: string, title: string, replyId: string) => {
        await process(buttonReply(db.wamid(id), from, await db.phoneNumberId(to), title, replyId));
      },
    );
    Then(
      "a conversa de {string} na {string} tem a mensagem recebida {string} do tipo {string}",
      async (_ctx, contact: string, org: string, body: string, type: string) => {
        expect(await db.messages(org, contact)).toEqual([{ type, body, direction: "inbound" }]);
      },
    );
  });

  Scenario("Áudio é gravado sem texto (a transcrição vem depois)", ({ When, Then }) => {
    When(
      "chega um áudio {string} de {string} para {string}",
      async (_ctx, id: string, from: string, to: string) => {
        await process(audioMessage(db.wamid(id), from, await db.phoneNumberId(to)));
      },
    );
    Then(
      "a conversa de {string} na {string} tem {int} mensagem do tipo {string} sem texto",
      async (_ctx, contact: string, org: string, n: number, type: string) => {
        const rows = await db.messages(org, contact);
        expect(rows).toHaveLength(n);
        expect(rows[0]).toEqual({ type, body: null, direction: "inbound" });
      },
    );
  });

  Scenario("Contato que já é lead fica ligado à conversa", ({ Given, When, Then }) => {
    let leadId = "";
    Given(
      "o lead {string} com o telefone {string} na {string}",
      async (_ctx, name: string, phone: string, org: string) => {
        leadId = await db.lead(org, name, phone);
      },
    );
    When(
      "chega a mensagem {string} de {string} para {string} com o texto {string}",
      async (_ctx, id: string, from: string, to: string, body: string) => {
        await text(id, from, to, body);
      },
    );
    Then(
      "a conversa de {string} na {string} fica ligada ao lead {string}",
      async (_ctx, contact: string, org: string) => {
        expect((await db.conversation(org, contact))?.lead_id).toBe(leadId);
      },
    );
  });

  Scenario("Aviso de entrega e leitura não vira mensagem", ({ When, Then, And }) => {
    When("chega um aviso de leitura para {string}", async (_ctx, to: string) => {
      await process(readStatus(await db.phoneNumberId(to)));
    });
    Then("nenhuma mensagem é gravada", async () => {
      expect(await db.countMessages()).toBe(0);
    });
    And("o bot não é acionado", () => {
      expect(botCalls).toBe(0);
      expect(failure).toBeNull();
    });
  });

  Scenario(
    "Erro no bot desfaz a gravação e a nova tentativa trata a mensagem",
    ({ Given, When, And, Then }) => {
      Given("o bot falha na primeira tentativa", () => {
        failNext = true;
      });
      When(
        "chega a mensagem {string} de {string} para {string} com o texto {string}",
        async (_ctx, id: string, from: string, to: string, body: string) => {
          await text(id, from, to, body);
          // A falha sobe (para o BullMQ tentar de novo) e nada fica gravado.
          expect(failure).toBeInstanceOf(Error);
          expect(await db.countMessages()).toBe(0);
        },
      );
      And("a fila tenta de novo a mesma mensagem", async () => {
        failure = null;
        await process(lastPayload);
      });
      Then(
        "a conversa de {string} na {string} tem {int} mensagem",
        async (_ctx, contact: string, org: string, n: number) => {
          expect(await db.messages(org, contact)).toHaveLength(n);
          expect(failure).toBeNull();
        },
      );
      And("o bot trata a mensagem com sucesso {int} vez", (_ctx, n: number) => {
        expect(botCalls).toBe(n);
      });
    },
  );
});
