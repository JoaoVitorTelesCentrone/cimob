import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { BUDGET, GOAL, TIMEFRAME } from "../../src/flow/options.ts";
import { qualifies } from "../../src/flow/qualify.ts";
import { HANDOFF_LABEL, privacyNotice } from "../../src/flow/texts.ts";
import { Chat, optionsOf } from "../support/chat.ts";
import { BotTestDb } from "../support/db.ts";

const feature = await loadFeature("../../features/bot/qualificacao.feature", { language: "pt" });

const ORG = "Horizonte Imóveis";
const STAGE: Record<string, string> = { qualificado: "qualified", novo: "new" };

describeFeature(feature, ({ Background, Scenario, ScenarioOutline, AfterEachScenario }) => {
  let db: BotTestDb;
  let chat: Chat;
  let contact = "";
  let unitPrice: number | null = null;
  let result: boolean | null = null;
  let sentBefore = 0;

  AfterEachScenario(async () => {
    await db.cleanup();
  });

  const lead = async () => {
    const row = await db.leadByPhone(ORG, contact);
    if (!row) throw new Error(`nenhum lead para ${contact}`);
    return row;
  };
  const lastOptions = async () => {
    const out = await db.outbound(ORG, contact);
    return optionsOf(out.at(-1)?.payload ?? {}).map((o) => o.title);
  };
  const handoffReasons = async () =>
    (await db.events((await lead()).id))
      .filter((e) => e.type === "handoff")
      .map((e) => HANDOFF_LABEL[e.data["reason"] as keyof typeof HANDOFF_LABEL]);
  const paused = async () => {
    const [row] = await db.sql<{ bot_paused: boolean; state: string }[]>`
      select bot_paused, state from conversations
      where organization_id = ${db.orgId(ORG)} and wa_contact = ${contact}`;
    return row;
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com os corretores no rodízio:",
      async (_ctx, org: string, table: { nome: string }[]) => {
        db = new BotTestDb();
        result = null;
        await db.org(org, "PHONE_QUAL");
        for (const row of table) await db.agent(org, row.nome);
        chat = new Chat(db, org, "PHONE_QUAL");
      },
    );
    And(
      // "$" e "." escapados: a biblioteca monta uma regex com o texto do passo.
      "a unidade {string} com preço de R\\$ 765\\.000 e status {string}",
      async (_ctx, code: string, status: string) => {
        unitPrice = 765_000;
        await db.unit(ORG, code, unitPrice, status === "disponível" ? "available" : "sold");
      },
    );
  });

  const send = (
    When: (t: string, f: (c: unknown, a: string, b: string) => Promise<void>) => void,
  ) => {
    When("o contato {string} envia {string}", async (_ctx, from: string, text: string) => {
      contact = from;
      await chat.type(contact, text);
    });
  };
  const respond = (Step: (t: string, f: (c: unknown, a: string) => Promise<void>) => void) => {
    Step("o contato responde {string}", async (_ctx, title: string) => {
      await chat.respond(contact, title);
    });
  };
  /** Várias respostas seguidas (a biblioteca não liga o mesmo texto de passo duas vezes num cenário). */
  const respondAll = (
    Step: (t: string, f: (c: unknown, table: { resposta: string }[]) => Promise<void>) => void,
  ) => {
    Step("o contato responde, em sequência:", async (_ctx, table: { resposta: string }[]) => {
      for (const row of table) await chat.respond(contact, row.resposta);
    });
  };
  const typeStep = (Step: (t: string, f: (c: unknown, a: string) => Promise<void>) => void) => {
    Step("o contato digita {string}", async (_ctx, text: string) => {
      await chat.type(contact, text);
    });
  };

  Scenario("Lead vindo do anúncio completa o fluxo e é qualificado", ({ When, Then, And }) => {
    send(When);
    Then(
      "o bot se apresenta como assistente virtual e oferece {string}",
      async (_ctx, option: string) => {
        expect((await chat.botSaid(contact)).join("\n")).toMatch(/assistente virtual/);
        expect(await lastOptions()).toContain(option);
      },
    );
    And("o bot pergunta se é para morar ou investir", async () => {
      expect(await lastOptions()).toEqual(expect.arrayContaining(GOAL.map((g) => g.title)));
    });
    respondAll(When);
    Then(
      "um lead {string} é criado no estágio {string}",
      async (_ctx, name: string, stage: string) => {
        expect(await lead()).toMatchObject({
          name,
          stage: STAGE[stage],
          qualified: true,
          intent: "Morar",
          budget_range: "R$ 600–800 mil",
          timeframe: "Até 3 meses",
          wants_visit: true,
        });
      },
    );
    And("o lead é atribuído a {string}", async (_ctx, owner: string) => {
      expect((await lead()).owner_name).toBe(owner);
    });
    And("o bot pausa a conversa", async () => {
      expect(await paused()).toEqual({ bot_paused: true, state: "handed_off" });
    });
  });

  Scenario("O lead aparece no CRM desde a primeira mensagem", ({ When, Then, And }) => {
    send(When);
    Then(
      "existe um lead do telefone {string} no estágio {string} ligado à unidade {string}",
      async (_ctx, phone: string, stage: string, code: string) => {
        contact = phone;
        expect(await lead()).toMatchObject({
          stage: STAGE[stage],
          unit_code: code,
          owner_name: null,
        });
      },
    );
    And("o lead tem a origem {string}", async (_ctx, source: string) => {
      expect((await lead()).source).toBe(source);
    });
  });

  Scenario(
    "Quem continua a conversa depois do aviso de privacidade tem o consentimento registrado",
    ({ When, Then, And }) => {
      send(When);
      Then("a saudação traz o aviso de privacidade", async () => {
        expect((await chat.botSaid(contact)).join("\n")).toContain(privacyNotice(null));
      });
      And("nenhum consentimento é registrado ainda", async () => {
        expect(await db.consents(ORG, contact)).toEqual([]);
      });
      respond(When);
      Then("o consentimento com o texto do aviso fica registrado", async () => {
        expect(await db.consents(ORG, contact)).toEqual([
          { scope: "privacy_notice", text_shown: privacyNotice(null) },
        ]);
      });
    },
  );

  const criterion = (
    When: (t: string, f: () => void) => void,
    Then: (t: string, f: () => void) => void,
    variables: Record<string, string>,
  ) => {
    When('ele informa a faixa "<faixa>" e o prazo "<prazo>"', () => {
      const budget = BUDGET.find((b) => b.title === variables["faixa"]);
      const timeframe = TIMEFRAME.find((t) => t.title === variables["prazo"]);
      if (!budget || !timeframe) throw new Error("opção desconhecida");
      result = qualifies({ budget, timeframe, unitPrice });
    });
    Then('o lead fica "<resultado>"', () => {
      expect(result ? "qualificado" : "em nutrição").toBe(variables["resultado"]);
    });
  };

  ScenarioOutline("Critério de qualificação", ({ Given, When, Then }, variables) => {
    Given('um lead interessado na unidade "AUR-502"', () => {
      expect(unitPrice).toBe(765_000);
    });
    criterion(When, Then, variables);
  });

  ScenarioOutline(
    "Lead sem unidade é qualificado só pelo prazo",
    ({ Given, When, Then }, variables) => {
      Given("um lead sem unidade de interesse", () => {
        unitPrice = null;
      });
      criterion(When, Then, variables);
    },
  );

  Scenario("Lead em nutrição não é passado a um corretor", ({ When, And, Then }) => {
    send(When);
    respondAll(And);
    Then("o lead {string} fica em nutrição sem corretor", async (_ctx, name: string) => {
      expect(await lead()).toMatchObject({
        name,
        stage: "new",
        qualified: false,
        owner_name: null,
      });
      expect((await db.events((await lead()).id)).map((e) => e.type)).toContain("nurture");
      expect((await paused())?.bot_paused).toBe(false);
    });
  });

  Scenario("Resposta digitada que corresponde a uma opção é aceita", ({ When, And, Then }) => {
    send(When);
    typeStep(And);
    Then("o bot pergunta a faixa de investimento", async () => {
      expect(await lastOptions()).toEqual(expect.arrayContaining(BUDGET.map((b) => b.title)));
      expect((await lead()).intent).toBe("Morar");
    });
  });

  Scenario("Duas respostas não entendidas passam o lead ao corretor", ({ When, And, Then }) => {
    send(When);
    typeStep(And);
    Then("o bot repete a pergunta de morar ou investir", async () => {
      const said = await chat.botSaid(contact);
      expect(said.at(-1)).toMatch(/Não entendi/);
      expect(await lastOptions()).toEqual(expect.arrayContaining(GOAL.map((g) => g.title)));
    });
    typeStep(When);
    Then(
      "o lead é atribuído a um corretor com a marcação {string}",
      async (_ctx, label: string) => {
        expect((await lead()).owner_name).not.toBeNull();
        expect(await handoffReasons()).toEqual([label]);
      },
    );
  });

  Scenario("Pedido de atendente interrompe o fluxo", ({ When, Then }) => {
    send(When);
    Then("o bot pergunta apenas o nome", async () => {
      const said = await chat.botSaid(contact);
      expect(said.at(-1)).toMatch(/Como posso te chamar\?/);
      expect(await lastOptions()).toEqual([]);
    });
    respond(When);
    Then(
      "o lead {string} é atribuído a um corretor com a marcação {string}",
      async (_ctx, name: string, label: string) => {
        expect(await lead()).toMatchObject({ name });
        expect((await lead()).owner_name).not.toBeNull();
        expect(await handoffReasons()).toEqual([label]);
      },
    );
  });

  Scenario("Conversa com o corretor não recebe resposta do bot", ({ Given, When, Then }) => {
    Given("uma conversa já passada ao corretor", async () => {
      contact = "5511900003333";
      await chat.type(contact, "atendente");
      await chat.type(contact, "Diego");
      expect((await paused())?.bot_paused).toBe(true);
      sentBefore = (await db.outbound(ORG, contact)).length;
    });
    typeStep(When);
    Then("o bot não responde", async () => {
      expect(await db.outbound(ORG, contact)).toHaveLength(sentBefore);
      expect(await db.messages(ORG, contact)).toContainEqual({
        type: "text",
        body: "oi, ainda está aí?",
        direction: "inbound",
      });
    });
  });
});
