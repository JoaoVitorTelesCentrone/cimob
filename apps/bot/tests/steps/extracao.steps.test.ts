import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import {
  createOpenRouterExtractor,
  ExtractionError,
  type Extraction,
  type Extractor,
} from "@c1imob/ai";
import { BUDGET, GOAL, TIMEFRAME, VISIT } from "../../src/flow/options.ts";
import { createFlowHandler } from "../../src/flow/runner.ts";
import { Chat, optionsOf } from "../support/chat.ts";
import { BotTestDb } from "../support/db.ts";

const feature = await loadFeature("../../features/bot/extracao.feature", { language: "pt" });

const ORG = "Horizonte";
const NOTHING: Extraction = {
  goal: null,
  budget: null,
  timeframe: null,
  wantsVisit: null,
  name: null,
  question: null,
  wantsHuman: false,
};
const idOf = (list: readonly { id: string; title: string }[], title: string) => {
  const found = list.find((o) => o.title === title);
  if (!found) throw new Error(`opção desconhecida: ${title}`);
  return found.id;
};

// Cenário @llm chama o OpenRouter de verdade: só roda com a chave (CI noturno ou à mão).
const realKey = process.env["OPENROUTER_API_KEY"];

describeFeature(
  feature,
  ({ Background, Scenario, AfterEachScenario }) => {
    let db: BotTestDb;
    let chat: Chat;
    let contact = "";
    let script = new Map<string, Extraction>();
    let down = false;
    let calls = 0;
    let real: Extractor | null = null;

    AfterEachScenario(async () => {
      await db.cleanup();
    });

    /** LLM falso: responde pelo roteiro do cenário (ou "nada entendido") e conta as chamadas. */
    const fake: Extractor = (req) => {
      calls += 1;
      if (real) return real(req);
      if (down) return Promise.reject(new ExtractionError("timeout"));
      return Promise.resolve(script.get(req.text) ?? NOTHING);
    };
    const lead = async () => {
      const row = await db.leadByPhone(ORG, contact);
      if (!row) throw new Error("sem lead");
      return row;
    };
    const lastOptions = async () =>
      optionsOf((await db.outbound(ORG, contact)).at(-1)?.payload ?? {}).map((o) => o.title);
    const lastBody = async () => (await db.outbound(ORG, contact)).at(-1)?.body ?? "";

    Background(({ Given, And }) => {
      Given(
        // "$" e "." escapados: a biblioteca monta uma regex com o texto do passo.
        "a imobiliária {string} com a unidade {string} de R\\$ 765\\.000",
        async (_ctx, org: string, code: string) => {
          db = new BotTestDb();
          script = new Map();
          down = false;
          calls = 0;
          real = null;
          await db.org(org, "PHONE_LLM");
          await db.agent(org, "Marina");
          await db.unit(org, code, 765_000, "available");
          chat = new Chat(db, org, "PHONE_LLM", createFlowHandler({ extractor: fake }));
        },
      );
      And(
        "o contato {string} começou a conversa sobre {string}",
        async (_ctx, from: string, code: string) => {
          contact = from;
          script.set(`Olá! Código: ${code}`, NOTHING);
          await chat.type(contact, `Olá! Código: ${code}`);
          calls = 0;
        },
      );
    });

    const typeStep = (
      When: (t: string, f: (c: unknown, text: string) => Promise<void>) => void,
    ) => {
      When("o contato digita {string}", async (_ctx, text: string) => {
        await chat.type(contact, text);
      });
    };
    const atBudget = (Given: (t: string, f: () => Promise<void>) => void) => {
      Given("a conversa está na pergunta da faixa de investimento", async () => {
        await chat.respond(contact, "Morar");
        expect(await lastOptions()).toContain("R$ 600–800 mil");
      });
    };

    Scenario("Vários campos numa resposta só", ({ Given, When, Then, And }) => {
      Given(
        "o LLM entende {string} como objetivo {string}, faixa {string} e prazo {string}",
        (_ctx, text: string, goal: string, budget: string, timeframe: string) => {
          script.set(text, {
            ...NOTHING,
            goal: idOf(GOAL, goal),
            budget: idOf(BUDGET, budget),
            timeframe: idOf(TIMEFRAME, timeframe),
          });
        },
      );
      typeStep(When);
      Then(
        "a ficha do lead fica com objetivo {string}, faixa {string} e prazo {string}",
        async (_ctx, goal: string, budget: string, timeframe: string) => {
          expect(await lead()).toMatchObject({ intent: goal, budget_range: budget, timeframe });
        },
      );
      And("o bot pergunta se quer visitar", async () => {
        expect(await lastOptions()).toEqual(expect.arrayContaining(VISIT.map((v) => v.title)));
      });
    });

    Scenario("Faixa escrita por extenso", ({ Given, And, When, Then }) => {
      atBudget(Given);
      And("o LLM entende {string} como faixa {string}", (_ctx, text: string, budget: string) => {
        script.set(text, { ...NOTHING, budget: idOf(BUDGET, budget) });
      });
      typeStep(When);
      Then("a ficha do lead fica com a faixa {string}", async (_ctx, budget: string) => {
        expect((await lead()).budget_range).toBe(budget);
      });
      And("o bot pergunta o prazo", async () => {
        expect(await lastOptions()).toEqual(expect.arrayContaining(TIMEFRAME.map((t) => t.title)));
      });
    });

    Scenario("Nome no meio da frase", ({ Given, And, When, Then }) => {
      Given("a conversa está na pergunta do nome", async () => {
        for (const title of ["Morar", "R$ 600–800 mil", "Até 3 meses", "Sim"]) {
          await chat.respond(contact, title);
        }
        expect(await lastBody()).toMatch(/Como posso te chamar\?/);
      });
      And("o LLM entende {string} como o nome {string}", (_ctx, text: string, name: string) => {
        script.set(text, { ...NOTHING, name });
      });
      typeStep(When);
      Then("o lead se chama {string}", async (_ctx, name: string) => {
        expect((await lead()).name).toBe(name);
      });
    });

    Scenario(
      "Pergunta sem ponto de interrogação é anotada para o corretor",
      ({ Given, When, Then, And }) => {
        Given(
          "o LLM entende {string} como a pergunta {string}",
          (_ctx, text: string, question: string) => {
            script.set(text, { ...NOTHING, question });
          },
        );
        typeStep(When);
        Then("a pergunta {string} fica registrada para o corretor", async (_ctx, q: string) => {
          expect(await db.events((await lead()).id)).toContainEqual({
            type: "question_for_agent",
            data: { question: q },
          });
        });
        And("o bot repete a pergunta de morar ou investir", async () => {
          expect(await lastOptions()).toEqual(expect.arrayContaining(GOAL.map((g) => g.title)));
        });
      },
    );

    Scenario("Pedido de pessoa escrito de outro jeito", ({ Given, When, Then }) => {
      Given("o LLM entende {string} como pedido de atendente", (_ctx, text: string) => {
        script.set(text, { ...NOTHING, wantsHuman: true });
      });
      typeStep(When);
      Then("o bot pergunta apenas o nome", async () => {
        expect(await lastBody()).toMatch(/Como posso te chamar\?$/);
        expect(await lastOptions()).toEqual([]);
      });
    });

    Scenario("Clique em botão não chama o LLM", ({ When, Then }) => {
      When("o contato toca no botão {string}", async (_ctx, title: string) => {
        await chat.respond(contact, title);
        expect((await lead()).intent).toBe(title);
      });
      Then("o LLM não é chamado", () => {
        expect(calls).toBe(0);
      });
    });

    Scenario(
      "LLM fora do ar cai na pergunta fixa e registra o erro",
      ({ Given, When, Then, And }) => {
        Given("o LLM está fora do ar", () => {
          down = true;
        });
        typeStep(When);
        Then("o bot repete a pergunta de morar ou investir", async () => {
          expect(await lastBody()).toMatch(/^Não entendi\./);
          expect(await lastOptions()).toEqual(expect.arrayContaining(GOAL.map((g) => g.title)));
        });
        And("fica registrado um erro do LLM no histórico do lead", async () => {
          const events = await db.events((await lead()).id);
          expect(events.map((e) => e.type)).toContain("llm_error");
        });
      },
    );

    Scenario("Com o LLM de verdade, faixa por extenso", ({ Given, And, When, Then }) => {
      Given("o LLM de verdade está configurado", () => {
        if (!realKey) throw new Error("defina OPENROUTER_API_KEY para os cenários @llm");
        real = createOpenRouterExtractor({ apiKey: realKey });
      });
      atBudget(And);
      typeStep(When);
      Then("a ficha do lead fica com a faixa {string}", async (_ctx, budget: string) => {
        expect((await lead()).budget_range).toBe(budget);
      });
    });
  },
  { excludeTags: realKey ? ["wip"] : ["wip", "llm"] },
);
