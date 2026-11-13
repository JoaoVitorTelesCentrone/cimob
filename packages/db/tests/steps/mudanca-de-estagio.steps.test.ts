import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/crm/mudanca-de-estagio.feature", {
  language: "pt",
});

type EventRow = { type: string; data: Record<string, unknown>; actor_id: string | null };

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let dbError: string | null = null;

  AfterEachScenario(async () => {
    await s.end();
  });

  const leadId = (name: string) => s.leads.get(name) ?? "";

  const move = async (user: string, lead: string, stage: string, reason: string | null) => {
    dbError = await s.expectError(() =>
      s.as(
        user,
        (c) =>
          c`update leads set stage = ${stage}::lead_stage, lost_reason = ${reason} where id = ${leadId(lead)}`,
      ),
    );
  };
  const stageEvents = (lead: string) =>
    s.conn<
      EventRow[]
    >`select type, data, actor_id from lead_events where lead_id = ${leadId(lead)} and type = 'stage_changed'`;
  const leadRow = async (lead: string) => {
    const [row] = await s.conn<{ stage: string; lost_reason: string | null }[]>`
      select stage::text, lost_reason from leads where id = ${leadId(lead)}`;
    return row;
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com o corretor {string}",
      async (_ctx, org: string, user: string) => {
        s = await Scenario.begin();
        dbError = null;
        await s.org(org);
        await s.member(user, org, "agent");
      },
    );
    And(
      "o lead {string} de {string} no estágio {string}",
      async (_ctx, lead: string, owner: string, stage: string) => {
        await s.lead("Horizonte", lead, undefined, owner);
        await s.conn`update leads set stage = ${stage}::lead_stage where id = ${leadId(lead)}`;
        await s.conn`delete from lead_events where lead_id = ${leadId(lead)}`;
      },
    );
  });

  Sc("Mudar o estágio gera um evento com origem, destino e autor", ({ When, Then }) => {
    When(
      "{string} move {string} para {string}",
      async (_ctx, user: string, lead: string, to: string) => {
        await move(user, lead, to, null);
        expect(dbError).toBeNull();
      },
    );
    Then(
      "{string} tem {int} evento {string} de {string} para {string} feito por {string}",
      async (
        _ctx,
        lead: string,
        n: number,
        type: string,
        from: string,
        to: string,
        user: string,
      ) => {
        const events = await stageEvents(lead);
        expect(events).toHaveLength(n);
        expect(events[0]).toMatchObject({ type, data: { from, to }, actor_id: s.users.get(user) });
      },
    );
  });

  Sc("Perdido sem motivo é recusado", ({ When, Then, And }) => {
    When(
      "{string} move {string} para {string} sem motivo",
      async (_ctx, user: string, lead: string, to: string) => {
        await move(user, lead, to, null);
      },
    );
    Then("o banco recusa a mudança", () => {
      expect(dbError).toMatch(/lost_reason|check constraint/i);
    });
    And("{string} continua no estágio {string}", async (_ctx, lead: string, stage: string) => {
      expect((await leadRow(lead))?.stage).toBe(stage);
    });
  });

  Sc("Perdido com motivo é aceito e o motivo vai para o histórico", ({ When, Then, And }) => {
    When(
      "{string} move {string} para {string} com o motivo {string}",
      async (_ctx, user: string, lead: string, to: string, reason: string) => {
        await move(user, lead, to, reason);
        expect(dbError).toBeNull();
      },
    );
    Then(
      "{string} está no estágio {string} com o motivo {string}",
      async (_ctx, lead: string, stage: string, reason: string) => {
        expect(await leadRow(lead)).toEqual({ stage, lost_reason: reason });
      },
    );
    And(
      "o evento de {string} registra o motivo {string}",
      async (_ctx, lead: string, reason: string) => {
        const [event] = await stageEvents(lead);
        expect(event?.data).toMatchObject({ reason });
      },
    );
  });

  Sc("Reabrir um lead perdido apaga o motivo", ({ Given, When, Then }) => {
    Given(
      "{string} foi perdida com o motivo {string}",
      async (_ctx, lead: string, reason: string) => {
        await s.conn`update leads set stage = 'lost', lost_reason = ${reason} where id = ${leadId(lead)}`;
      },
    );
    When(
      "{string} move {string} para {string}",
      async (_ctx, user: string, lead: string, to: string) => {
        await s.as(
          user,
          (c) => c`update leads set stage = ${to}::lead_stage where id = ${leadId(lead)}`,
        );
      },
    );
    Then(
      "{string} está no estágio {string} sem motivo de perda",
      async (_ctx, lead: string, stage: string) => {
        expect(await leadRow(lead)).toEqual({ stage, lost_reason: null });
      },
    );
  });

  Sc("Alterar outro campo não gera evento de estágio", ({ When, Then }) => {
    When(
      "{string} altera o prazo de {string} para {string}",
      async (_ctx, user: string, lead: string, value: string) => {
        await s.as(
          user,
          (c) => c`update leads set timeframe = ${value} where id = ${leadId(lead)}`,
        );
      },
    );
    Then("{string} não tem eventos {string}", async (_ctx, lead: string, type: string) => {
      const events =
        await s.conn`select 1 from lead_events where lead_id = ${leadId(lead)} and type = ${type}`;
      expect(events).toHaveLength(0);
    });
  });
});
