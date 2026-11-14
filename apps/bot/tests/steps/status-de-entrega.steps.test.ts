import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { processInbound } from "../../src/inbound/process.ts";
import { createPostgresStore } from "../../src/inbound/store.ts";
import { BotTestDb } from "../support/db.ts";
import { deliveryStatus } from "../support/payloads.ts";

const feature = await loadFeature("../../features/bot/status-de-entrega.feature", {
  language: "pt",
});

describeFeature(feature, ({ Background, Scenario, AfterEachScenario }) => {
  let db: BotTestDb;
  let alerts: string[] = [];

  AfterEachScenario(async () => {
    await db.cleanup();
  });

  const notify = async (
    phone: string,
    id: string,
    status: "delivered" | "read" | "failed",
    error?: { code: number; title: string },
  ) => {
    await processInbound(
      deliveryStatus(await db.phoneNumberId(phone), db.wamid(id), status, error),
      {
        store: createPostgresStore(db.sql),
        onMessage: () => Promise.reject(new Error("status não aciona o bot")),
        log: () => undefined,
        alert: (text) => {
          alerts.push(text);
          return Promise.resolve();
        },
      },
    );
  };
  const delivery = async (id: string) => {
    const row = await db.deliveryOf(db.wamid(id));
    if (!row) throw new Error(`mensagem desconhecida: ${id}`);
    return row;
  };

  const setupOrg = (
    Given: (t: string, f: (c: unknown, o: string, p: string) => Promise<void>) => void,
  ) => {
    Given(
      "a imobiliária {string} com o número do WhatsApp {string}",
      async (_ctx, org: string, phone: string) => {
        await db.org(org, phone);
      },
    );
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com o número do WhatsApp {string}",
      async (_ctx, org: string, phone: string) => {
        db = new BotTestDb();
        alerts = [];
        await db.org(org, phone);
      },
    );
    And(
      "a mensagem {string} enviada pelo bot para {string} na {string}",
      async (_ctx, id: string, contact: string, org: string) => {
        await db.sentMessage(org, contact, db.wamid(id));
      },
    );
  });

  const delivered = (
    step: (t: string, f: (c: unknown, p: string, id: string) => Promise<void>) => void,
  ) => {
    step("a Meta avisa pelo {string} que {string} foi entregue", async (_ctx, phone, id) => {
      await notify(phone, id, "delivered");
    });
  };
  const read = (
    step: (t: string, f: (c: unknown, p: string, id: string) => Promise<void>) => void,
  ) => {
    step("a Meta avisa pelo {string} que {string} foi lida", async (_ctx, phone, id) => {
      await notify(phone, id, "read");
    });
  };
  const deliveredAndRead = (
    step: (t: string, f: (c: unknown, id: string) => Promise<void>) => void,
  ) => {
    step("a mensagem {string} está marcada como entregue e lida", async (_ctx, id) => {
      expect(await delivery(id)).toMatchObject({
        delivered: true,
        read: true,
        send_status: "sent",
      });
    });
  };

  Scenario("Entregue e lida ficam registradas na mensagem", ({ When, And, Then }) => {
    delivered(When);
    read(And);
    deliveredAndRead(Then);
  });

  Scenario("Leitura que chega antes da entrega também marca a entrega", ({ When, Then }) => {
    read(When);
    deliveredAndRead(Then);
  });

  Scenario("Recusa depois de aceita marca a falha e alerta a operação", ({ When, Then, And }) => {
    When(
      "a Meta avisa pelo {string} que {string} falhou com o erro {int} {string}",
      async (_ctx, phone: string, id: string, code: number, title: string) => {
        await notify(phone, id, "failed", { code, title });
      },
    );
    Then(
      "a mensagem {string} fica com a falha {string}",
      async (_ctx, id: string, error: string) => {
        expect(await delivery(id)).toMatchObject({ send_status: "failed", send_error: error });
      },
    );
    And("a operação recebe um alerta de falha de entrega na {string}", (_ctx, org: string) => {
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toContain(`Falha de entrega (${org})`);
      expect(alerts[0]).not.toContain("5511987654321");
    });
  });

  Scenario(
    "Aviso pelo número de outra imobiliária não mexe na mensagem",
    ({ Given, When, Then }) => {
      setupOrg(Given);
      delivered(When);
      Then("a mensagem {string} não está marcada como entregue", async (_ctx, id: string) => {
        expect(await delivery(id)).toMatchObject({ delivered: false });
      });
    },
  );
});
