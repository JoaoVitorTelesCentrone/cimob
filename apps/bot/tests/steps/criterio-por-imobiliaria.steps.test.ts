import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Chat } from "../support/chat.ts";
import { BotTestDb } from "../support/db.ts";

const feature = await loadFeature("../../features/bot/criterio-por-imobiliaria.feature", {
  language: "pt",
});

const ORG = "Horizonte Imóveis";

describeFeature(feature, ({ Background, Scenario, AfterEachScenario }) => {
  let db: BotTestDb;
  let chat: Chat;

  AfterEachScenario(async () => {
    await db.cleanup();
  });

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com a corretora {string} no rodízio",
      async (_ctx, org: string, agent: string) => {
        db = new BotTestDb();
        await db.org(org, "PHONE_CRIT");
        await db.agent(org, agent);
        chat = new Chat(db, org, "PHONE_CRIT");
      },
    );
    And(
      // "$" e "." escapados: a biblioteca monta uma regex com o texto do passo.
      "a unidade {string} com preço de R\\$ 850\\.000 disponível",
      async (_ctx, code: string) => {
        await db.unit(ORG, code, 850_000, "available");
      },
    );
  });

  const setCriteria = (
    Given: (t: string, f: (c: unknown, org: string, m: number, p: number) => Promise<void>) => void,
  ) => {
    Given(
      "o critério da {string} é prazo de até {int} meses e {int}% do preço",
      async (_ctx, org, months, share) => {
        await db.sql`update organizations
                     set qualify_timeframe = ${`${String(months)}m`}, qualify_price_share = ${share / 100}
                     where id = ${db.orgId(org)}`;
      },
    );
  };
  const converse = (
    When: (
      t: string,
      f: (c: unknown, contact: string, code: string, table: { resposta: string }[]) => Promise<void>,
    ) => void,
  ) => {
    When(
      "o contato {string} pede a unidade {string} e responde:",
      async (_ctx, contact, code, table) => {
        await chat.type(contact, `Olá! Código: ${code}`);
        for (const row of table) await chat.respond(contact, row.resposta);
      },
    );
  };
  const leadOf = async (contact: string) => {
    const row = await db.leadByPhone(ORG, contact);
    if (!row) throw new Error(`nenhum lead para ${contact}`);
    return row;
  };
  const isQualified = (
    Then: (t: string, f: (c: unknown, contact: string, label: string) => Promise<void>) => void,
  ) => {
    Then("o lead de {string} fica {string}", async (_ctx, contact, label) => {
      expect(label).toBe("qualificado");
      expect(await leadOf(contact)).toMatchObject({ stage: "qualified", qualified: true });
    });
  };
  const inNurture = (
    Then: (t: string, f: (c: unknown, contact: string) => Promise<void>) => void,
  ) => {
    Then("o lead de {string} fica em nutrição", async (_ctx, contact) => {
      const lead = await leadOf(contact);
      expect(lead).toMatchObject({ stage: "new", qualified: false, owner_name: null });
      expect((await db.events(lead.id)).map((e) => e.type)).toContain("nurture");
    });
  };

  Scenario("Critério padrão qualifica quem compra em 3 a 6 meses e cobre 90% do preço", ({ When, Then }) => {
    converse(When);
    isQualified(Then);
  });

  Scenario(
    "Critério de até 3 meses manda para nutrição quem compra em 3 a 6 meses",
    ({ Given, When, Then }) => {
      setCriteria(Given);
      converse(When);
      inNurture(Then);
    },
  );

  Scenario(
    "Critério de 100% do preço manda para nutrição quem não cobre a unidade inteira",
    ({ Given, When, Then }) => {
      setCriteria(Given);
      converse(When);
      inNurture(Then);
    },
  );
});
