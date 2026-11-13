import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { runFollowUps } from "../../src/agent/followup.ts";
import { RESPONDED_BUTTON, STAGE_OPTIONS, STAGE_TEMPLATE } from "../../src/agent/templates.ts";
import { Chat } from "../support/chat.ts";
import { BotTestDb } from "../support/db.ts";
import { templateButton, textMessage } from "../support/payloads.ts";

const feature = await loadFeature("../../features/bot/handoff.feature", { language: "pt" });

const ORG = "Horizonte";
const LEAD_PHONE = "5511987654321";

type Template = {
  name: string;
  components: { type: string; parameters: { type: string; text?: string; payload?: string }[] }[];
};

describeFeature(feature, ({ Background, Scenario, ScenarioOutline, AfterEachScenario }) => {
  let db: BotTestDb;
  let chat: Chat;
  const agentPhone = new Map<string, string>();

  AfterEachScenario(async () => {
    await db.cleanup();
  });

  const templatesTo = async (agent: string) =>
    (await db.outbound(ORG, agentPhone.get(agent) ?? "")).flatMap((m) =>
      m.payload["type"] === "template" ? [m.payload["template"] as Template] : [],
    );
  const texts = (t: Template) =>
    t.components.flatMap((c) => c.parameters.map((p) => p.text ?? "")).join(" | ");
  const payloads = (t: Template) =>
    t.components.flatMap((c) => c.parameters.flatMap((p) => (p.payload ? [p.payload] : [])));
  const lastTextTo = async (agent: string) =>
    (await db.outbound(ORG, agentPhone.get(agent) ?? "")).at(-1)?.body ?? "";
  const lead = async (phone = LEAD_PHONE) => {
    const row = await db.leadByPhone(ORG, phone);
    if (!row) throw new Error("sem lead");
    return row;
  };
  const leadRow = async (id: string) => {
    const [row] = await db.sql<
      { stage: string; lost_reason: string | null; first_response_at: Date | null }[]
    >`select stage::text, lost_reason, first_response_at from leads where id = ${id}`;
    return row;
  };
  /** O corretor responde pelo WhatsApp dele (toque num botão de modelo ou texto). */
  const agentTaps = async (agent: string, text: string, payload: string) => {
    await chat.deliver(
      templateButton(
        `wamid.${randomUUID()}`,
        agentPhone.get(agent) ?? "",
        await chat.to(),
        text,
        payload,
      ),
    );
  };
  const agentTypes = async (agent: string, text: string) => {
    await chat.deliver(
      textMessage(`wamid.${randomUUID()}`, agentPhone.get(agent) ?? "", await chat.to(), text),
    );
  };
  const qualify = async (name: string, budget: string, question: string) => {
    await chat.type(LEAD_PHONE, "Olá! Código: AUR-502");
    await chat.respond(LEAD_PHONE, "Morar");
    await chat.respond(LEAD_PHONE, budget);
    await chat.type(LEAD_PHONE, question);
    await chat.respond(LEAD_PHONE, "Até 3 meses");
    await chat.respond(LEAD_PHONE, "Sim");
    await chat.type(LEAD_PHONE, name);
  };
  const handedOver = async (hoursAgo: number) => {
    await qualify("Ana Souza", "R$ 600–800 mil", "aceita pet?");
    await db.sql`update lead_events set created_at = now() - make_interval(hours => ${hoursAgo})
                 where lead_id = ${(await lead()).id} and type = 'handoff'`;
  };
  const stageQuestionSent = async () => {
    await handedOver(25);
    await runFollowUps(db.sql);
  };
  const stagePayload = async (agent: string, title: string) => {
    const option = STAGE_OPTIONS.find((o) => o.title === title);
    const template = (await templatesTo(agent)).find((t) => t.name === STAGE_TEMPLATE);
    const found =
      template && payloads(template).find((p) => p.startsWith(`stage:${option?.code ?? "?"}:`));
    if (!found) throw new Error(`botão de estágio não encontrado: ${title}`);
    return found;
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com a corretora {string} no rodízio e WhatsApp {string}",
      async (_ctx, org: string, agent: string, phone: string) => {
        db = new BotTestDb();
        await db.org(org, "PHONE_HANDOFF");
        await db.agent(org, agent);
        await db.setWhatsapp(org, agent, phone);
        agentPhone.set(agent, phone);
        chat = new Chat(db, org, "PHONE_HANDOFF");
      },
    );
    And("a unidade {string} disponível", async (_ctx, code: string) => {
      await db.unit(ORG, code, 765_000, "available");
    });
  });

  const finishes = (
    When: (t: string, f: (c: unknown, n: string, b: string, q: string) => Promise<void>) => void,
  ) => {
    When(
      "o lead {string} termina a qualificação na faixa {string} e pergunta {string}",
      async (_ctx, name: string, budget: string, question: string) => {
        await qualify(name, budget, question);
        expect((await lead()).owner_name).toBe("Marina Alves");
      },
    );
  };

  Scenario("Corretor recebe o resumo do lead qualificado", ({ When, Then, And }) => {
    finishes(When);
    Then(
      "{string} recebe o modelo {string} com {string}, {string}, {string} e {string}",
      async (_ctx, agent: string, name: string, a: string, b: string, c: string, d: string) => {
        const [template] = await templatesTo(agent);
        expect(template?.name).toBe(name);
        for (const part of [a, b, c, d]) expect(texts(template as Template)).toContain(part);
      },
    );
    And("o resumo tem o botão {string}", async (_ctx, title: string) => {
      expect(RESPONDED_BUTTON).toBe(title);
      const [template] = await templatesTo("Marina Alves");
      expect(payloads(template as Template)).toEqual([`responded:${(await lead()).id}`]);
    });
  });

  Scenario(
    "Corretor sem WhatsApp cadastrado fica registrado no histórico",
    ({ Given, When, Then, And }) => {
      Given("{string} está sem WhatsApp cadastrado", async (_ctx, agent: string) => {
        await db.setWhatsapp(ORG, agent, null);
      });
      finishes(When);
      Then("nenhum resumo é enviado", async () => {
        expect(await templatesTo("Marina Alves")).toEqual([]);
      });
      And("o histórico de {string} registra que o corretor não foi avisado", async () => {
        const types = (await db.events((await lead()).id)).map((e) => e.type);
        expect(types).toContain("agent_not_notified");
      });
    },
  );

  Scenario('"Já respondi" registra a primeira resposta', ({ Given, When, Then, And }) => {
    Given(
      "o resumo de {string} foi enviado a {string}",
      async (_ctx, name: string, agent: string) => {
        await qualify(name, "R$ 600–800 mil", "aceita pet?");
        expect(await templatesTo(agent)).toHaveLength(1);
      },
    );
    When("{string} toca em {string}", async (_ctx, agent: string, title: string) => {
      const [template] = await templatesTo(agent);
      await agentTaps(agent, title, payloads(template as Template)[0] ?? "");
    });
    Then("a primeira resposta de {string} fica registrada", async () => {
      expect((await leadRow((await lead()).id))?.first_response_at).toBeInstanceOf(Date);
    });
    And("{string} recebe a confirmação {string}", async (_ctx, agent: string, text: string) => {
      expect(await lastTextTo(agent)).toContain(text);
    });
    And("o número de {string} não vira lead", async (_ctx, agent: string) => {
      expect(await db.leadByPhone(ORG, agentPhone.get(agent) ?? "")).toBeNull();
    });
  });

  Scenario("Pergunta de estágio no dia seguinte", ({ Given, When, Then, And }) => {
    Given(
      "{string} foi passada a {string} há {int} horas",
      async (_ctx, _name: string, _agent: string, hours: number) => {
        await handedOver(hours);
      },
    );
    When("a rotina de acompanhamento roda", async () => {
      await runFollowUps(db.sql);
    });
    Then(
      "{string} recebe o modelo {string} sobre {string} com {int} opções",
      async (_ctx, agent: string, name: string, leadName: string, n: number) => {
        const template = (await templatesTo(agent)).find((t) => t.name === name);
        expect(template && texts(template)).toContain(leadName);
        expect(payloads(template as Template)).toHaveLength(n);
      },
    );
    And("na rodada seguinte a pergunta não é mandada de novo", async () => {
      await runFollowUps(db.sql);
      const sent = (await templatesTo("Marina Alves")).filter((t) => t.name === STAGE_TEMPLATE);
      expect(sent).toHaveLength(1);
    });
  });

  ScenarioOutline("Resposta do corretor atualiza o estágio", ({ Given, When, Then, And }, v) => {
    Given('a pergunta de estágio de "Ana Souza" foi enviada a "Marina Alves"', stageQuestionSent);
    When('"Marina Alves" toca em "<opção>"', async () => {
      await agentTaps(
        "Marina Alves",
        String(v["opção"]),
        await stagePayload("Marina Alves", String(v["opção"])),
      );
    });
    Then('"Ana Souza" fica no estágio "<estágio>"', async () => {
      expect((await leadRow((await lead()).id))?.stage).toBe(String(v["estágio"]));
    });
    And('a primeira resposta de "Ana Souza" fica registrada', async () => {
      expect((await leadRow((await lead()).id))?.first_response_at).toBeInstanceOf(Date);
    });
  });

  Scenario("Perdido pede o motivo antes de salvar", ({ Given, When, Then, And }) => {
    Given("a pergunta de estágio de {string} foi enviada a {string}", stageQuestionSent);
    When("{string} toca em {string}", async (_ctx, agent: string, title: string) => {
      await agentTaps(agent, title, await stagePayload(agent, title));
    });
    Then("{string} recebe a pergunta {string}", async (_ctx, agent: string, text: string) => {
      expect(await lastTextTo(agent)).toBe(text);
    });
    And("{string} continua no estágio {string}", async (_ctx, _name: string, stage: string) => {
      expect((await leadRow((await lead()).id))?.stage).toBe(stage);
    });
    When("{string} digita {string}", async (_ctx, agent: string, text: string) => {
      await agentTypes(agent, text);
    });
    Then(
      "{string} fica perdida com o motivo {string}",
      async (_ctx, _name: string, reason: string) => {
        expect(await leadRow((await lead()).id)).toMatchObject({
          stage: "lost",
          lost_reason: reason,
        });
      },
    );
  });

  Scenario("Corretor não atualiza lead de outro corretor", ({ Given, When, Then }) => {
    let brunoId = "";
    Given("o lead {string} é de outro corretor", async (_ctx, name: string) => {
      const rafael = await db.agent(ORG, "Rafael", false);
      brunoId = await db.lead(ORG, name, "5511955550000");
      await db.sql`update leads set owner_id = ${rafael}, assigned_at = now(), stage = 'qualified'
                   where id = ${brunoId}`;
    });
    When("{string} toca num botão de estágio de {string}", async (_ctx, agent: string) => {
      await agentTaps(agent, "Proposta", `stage:proposal:${brunoId}`);
    });
    Then("{string} continua no estágio {string}", async (_ctx, _name: string, stage: string) => {
      expect((await leadRow(brunoId))?.stage).toBe(stage);
    });
  });
});
