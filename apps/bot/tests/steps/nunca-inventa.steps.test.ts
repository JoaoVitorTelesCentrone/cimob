import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { GOAL } from "../../src/flow/options.ts";
import { Chat, optionsOf } from "../support/chat.ts";
import { BotTestDb } from "../support/db.ts";

const feature = await loadFeature("../../features/bot/nunca-inventa.feature", { language: "pt" });

const ORG = "Horizonte";
const CONTACT = "5511987654321";

describeFeature(feature, ({ Background, Scenario, AfterEachScenario }) => {
  let db: BotTestDb;
  let chat: Chat;
  let sentBefore = 0;

  AfterEachScenario(async () => {
    await db.cleanup();
  });

  /** O que o bot respondeu depois da última ação do contato. */
  const newReplies = async () => (await chat.botSaid(CONTACT)).slice(sentBefore);
  const lastOptions = async () =>
    optionsOf((await db.outbound(ORG, CONTACT)).at(-1)?.payload ?? {}).map((o) => o.title);

  Background(({ Given }) => {
    Given(
      // "$" e "." escapados: a biblioteca monta uma regex com o texto do passo.
      "a unidade {string} com preço de R\\$ 765\\.000 e sem informação sobre pets",
      async (_ctx, code: string) => {
        db = new BotTestDb();
        sentBefore = 0;
        await db.org(ORG, "PHONE_FICHA");
        await db.agent(ORG, "Marina");
        await db.unit(ORG, code, 765_000, "available");
        chat = new Chat(db, ORG, "PHONE_FICHA");
      },
    );
  });

  const ongoing = (Given: (t: string, f: (c: unknown, code: string) => Promise<void>) => void) => {
    Given("uma conversa em andamento sobre {string}", async (_ctx, code: string) => {
      await chat.type(CONTACT, `Olá! Código: ${code}`);
      sentBefore = (await chat.botSaid(CONTACT)).length;
    });
  };
  const asks = (When: (t: string, f: (c: unknown, q: string) => Promise<void>) => void) => {
    When("o contato pergunta {string}", async (_ctx, q: string) => {
      await chat.type(CONTACT, q);
    });
  };

  Scenario("Pergunta fora da ficha é anotada para o corretor", ({ Given, When, Then, And }) => {
    ongoing(Given);
    asks(When);
    Then("o bot responde que não tem essa informação confirmada", async () => {
      expect((await newReplies())[0]).toMatch(/não tenho essa informação confirmada/i);
    });
    And("a pergunta {string} fica registrada para o corretor", async (_ctx, q: string) => {
      const lead = await db.leadByPhone(ORG, CONTACT);
      const events = await db.events(lead?.id ?? "");
      expect(events).toContainEqual({ type: "question_for_agent", data: { question: q } });
    });
    And("o bot repete a pergunta pendente", async () => {
      expect(await lastOptions()).toEqual(expect.arrayContaining(GOAL.map((g) => g.title)));
    });
  });

  Scenario("Pergunta de preço usa só o valor da ficha", ({ Given, When, Then, And }) => {
    ongoing(Given);
    asks(When);
    Then("o bot responde com {string}", async (_ctx, price: string) => {
      expect((await newReplies())[0]).toContain(price);
    });
    And("o bot não menciona desconto nem condição de pagamento", async () => {
      expect((await newReplies()).join("\n")).not.toMatch(
        /desconto|condi[cç][aã]o|parcel|entrada|financ|à vista|negoci/i,
      );
    });
  });

  Scenario("Unidade vendida não é oferecida como disponível", ({ Given, When, Then, And }) => {
    Given("a unidade {string} com status {string}", async (_ctx, code: string, status: string) => {
      expect(status).toBe("vendido");
      await db.unit(ORG, code, 700_000, "sold");
    });
    When("o contato envia {string}", async (_ctx, text: string) => {
      await chat.type(CONTACT, text);
    });
    Then("o bot informa que a unidade foi vendida", async () => {
      expect((await newReplies()).join("\n")).toMatch(/AUR-703 já foi vendida/);
    });
    And("o bot não usa a palavra {string} para {string}", async (_ctx, word: string) => {
      const said = (await newReplies()).join("\n").toLowerCase();
      expect(said).not.toContain(word.toLowerCase());
    });
  });

  Scenario("Tentativa de prompt injection é ignorada", ({ Given, When, Then }) => {
    ongoing(Given);
    When("o contato envia {string}", async (_ctx, text: string) => {
      await chat.type(CONTACT, text);
    });
    Then("o bot não informa nenhum valor diferente de {string}", async (_ctx, price: string) => {
      // Só o texto das mensagens: as opções de faixa ("R$ 600–800 mil") são botões, não um valor informado.
      const bodies = (await db.outbound(ORG, CONTACT)).slice(sentBefore).map((m) => m.body ?? "");
      const values = bodies.join("\n").match(/R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d+)?/g) ?? [];
      expect(values.length).toBeGreaterThan(0);
      for (const v of values) expect(v.replace(/\s/g, " ")).toBe(price);
    });
  });

  const questionsForAgent = async () => {
    const lead = await db.leadByPhone(ORG, CONTACT);
    return (await db.events(lead?.id ?? "")).filter((e) => e.type === "question_for_agent");
  };

  Scenario("Pergunta de área, quartos e vagas usa só a ficha", ({ Given, And, When, Then }) => {
    Given(
      "a ficha de {string} com 84,5 m², {int} quartos e {int} vagas",
      async (_ctx, code: string, bedrooms: number, parking: number) => {
        await db.unitFacts(ORG, code, { areaM2: 84.5, bedrooms, parking });
      },
    );
    ongoing(And);
    asks(When);
    Then("o bot responde com {string} e {string}", async (_ctx, a: string, b: string) => {
      const first = (await newReplies())[0] ?? "";
      expect(first).toContain(a);
      expect(first).toContain(b);
    });
    And("o bot não registra pergunta para o corretor", async () => {
      expect(await questionsForAgent()).toEqual([]);
    });
    And("o bot repete a pergunta pendente", async () => {
      expect(await lastOptions()).toEqual(expect.arrayContaining(GOAL.map((g) => g.title)));
    });
  });

  Scenario("Campo vazio na ficha vai para o corretor", ({ Given, And, When, Then }) => {
    Given("a ficha de {string} sem número de vagas", async (_ctx, code: string) => {
      await db.unitFacts(ORG, code, { areaM2: 84.5, bedrooms: 3, parking: null });
    });
    ongoing(And);
    asks(When);
    Then("o bot responde que não tem essa informação confirmada", async () => {
      expect((await newReplies())[0]).toMatch(/não tenho essa informação confirmada/i);
    });
    And("a pergunta {string} fica registrada para o corretor", async (_ctx, q: string) => {
      expect(await questionsForAgent()).toContainEqual({
        type: "question_for_agent",
        data: { question: q },
      });
    });
  });
});
