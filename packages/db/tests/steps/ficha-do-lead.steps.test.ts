import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/crm/ficha-do-lead.feature", { language: "pt" });

/** "2026-11-20 10:00" em Brasília. */
const at = (text: string) => new Date(`${text.replace(" ", "T")}:00-03:00`);

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let errors: (string | null)[] = [];
  let firstResponse: Date | null = null;

  AfterEachScenario(async () => {
    await s.end();
  });

  const leadId = (name: string) => s.leads.get(name) ?? "";
  const lead = async (name: string) => {
    const [row] = await s.conn<
      {
        first_response_at: Date | null;
        next_step: string | null;
        next_step_at: Date | null;
        visit_at: Date | null;
        stage: string;
      }[]
    >`select first_response_at, next_step, next_step_at, visit_at, stage::text from leads where id = ${leadId(name)}`;
    return row;
  };
  const respond = (user: string, name: string) =>
    s.as(user, (c) => c`select public.record_first_response(${leadId(name)})`);
  const nextStep = (user: string, name: string, text: string | null, when: Date | null) =>
    s.as(user, (c) => c`select public.set_next_step(${leadId(name)}, ${text}, ${when})`);
  const visit = (user: string, name: string, when: Date) =>
    s.as(user, (c) => c`select public.set_visit_at(${leadId(name)}, ${when})`);

  type Step<A extends unknown[]> = (t: string, f: (c: unknown, ...a: A) => void | Promise<void>) => void;
  const defines = (Step: Step<[string, string, string, string]>) => {
    Step(
      "{string} define o próximo passo de {string} como {string} para {string}",
      async (_ctx, user, name, text, when) => {
        await nextStep(user, name, text, at(when));
      },
    );
  };
  const nextStepIs = (Step: Step<[string, string, string]>) => {
    Step("o próximo passo de {string} é {string} para {string}", async (_ctx, name, text, when) => {
      const l = await lead(name);
      expect({ text: l?.next_step, at: l?.next_step_at?.getTime() }).toEqual({ text, at: at(when).getTime() });
    });
  };
  const historyHas = (Step: Step<[string, string, string]>) => {
    Step("o histórico de {string} tem {string} feito por {string}", async (_ctx, name, type, user) => {
      const rows = await s.conn<{ actor_id: string | null }[]>`
        select actor_id from lead_events where lead_id = ${leadId(name)} and type = ${type}`;
      expect(rows.map((r) => r.actor_id)).toEqual([s.users.get(user)]);
    });
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com a gestora {string} e os corretores {string} e {string}",
      async (_ctx, org: string, admin: string, a: string, b: string) => {
        s = await Scenario.begin();
        errors = [];
        firstResponse = null;
        await s.org(org);
        await s.member(admin, org, "org_admin");
        await s.member(a, org, "agent");
        await s.member(b, org, "agent");
      },
    );
    And(
      "o lead {string} atribuído a {string} há {int} horas, no estágio {string}",
      async (_ctx, name: string, owner: string, hours: number, stage: string) => {
        await s.lead("Horizonte", name, undefined, owner);
        await s.conn`update leads set assigned_at = now() - make_interval(hours => ${hours}),
                     stage = ${stage}::lead_stage where id = ${leadId(name)}`;
      },
    );
  });

  Sc("Corretora registra a 1ª resposta com a hora do servidor", ({ When, Then, And }) => {
    When("{string} registra a 1ª resposta de {string}", async (_ctx, user: string, name: string) => {
      await respond(user, name);
    });
    Then("{string} tem a 1ª resposta registrada agora", async (_ctx, name: string) => {
      const [now] = await s.conn<{ now: Date }[]>`select now()`;
      firstResponse = (await lead(name))?.first_response_at ?? null;
      expect(firstResponse?.getTime()).toBe(now?.now.getTime());
    });
    historyHas(And);
    When("{string} registra a 1ª resposta de {string} de novo", async (_ctx, user: string, name: string) => {
      await respond(user, name);
    });
    Then("a 1ª resposta de {string} não muda", async (_ctx, name: string) => {
      expect((await lead(name))?.first_response_at?.getTime()).toBe(firstResponse?.getTime());
      const rows = await s.conn`select 1 from lead_events where lead_id = ${leadId(name)} and type = 'first_response'`;
      expect(rows).toHaveLength(1);
    });
  });

  Sc("Corretora não ajusta horários nem dono pelo app", ({ When, Then }) => {
    When(
      "{string} tenta mudar a 1ª resposta, a atribuição e o dono de {string}",
      async (_ctx, user: string, name: string) => {
        const id = leadId(name);
        errors = [
          await s.expectError(() => s.as(user, (c) => c`update leads set first_response_at = now() - interval '3 hours' where id = ${id}`)),
          await s.expectError(() => s.as(user, (c) => c`update leads set assigned_at = now() where id = ${id}`)),
          await s.expectError(() => s.as(user, (c) => c`update leads set owner_id = ${s.users.get("Rafael") ?? ""} where id = ${id}`)),
        ];
      },
    );
    Then("o banco recusa nas três", () => {
      for (const e of errors) expect(e).toMatch(/permission denied/);
    });
  });

  Sc("Corretora define o próximo passo com data", ({ When, Then, And }) => {
    defines(When);
    nextStepIs(Then);
    historyHas(And);
  });

  Sc("Próximo passo vazio limpa", ({ Given, When, Then }) => {
    Given(
      "{string} definiu o próximo passo de {string} como {string} para {string}",
      async (_ctx, user: string, name: string, text: string, when: string) => {
        await nextStep(user, name, text, at(when));
      },
    );
    When("{string} limpa o próximo passo de {string}", async (_ctx, user: string, name: string) => {
      await nextStep(user, name, null, null);
    });
    Then("{string} fica sem próximo passo", async (_ctx, name: string) => {
      expect(await lead(name)).toMatchObject({ next_step: null, next_step_at: null });
    });
  });

  Sc("Marcar a data da visita leva o lead para \"Visita agendada\"", ({ When, Then, And }) => {
    When("{string} marca a visita de {string} para {string}", async (_ctx, user: string, name: string, when: string) => {
      await visit(user, name, at(when));
    });
    Then("a visita de {string} fica para {string}", async (_ctx, name: string, when: string) => {
      expect((await lead(name))?.visit_at?.getTime()).toBe(at(when).getTime());
    });
    And("{string} fica no estágio {string}", async (_ctx, name: string, stage: string) => {
      expect((await lead(name))?.stage).toBe(stage);
    });
    historyHas(And);
  });

  Sc("Outro corretor não mexe na ficha", ({ When, Then }) => {
    When(
      "{string} tenta registrar a 1ª resposta, o próximo passo e a visita de {string}",
      async (_ctx, user: string, name: string) => {
        errors = [
          await s.expectError(() => respond(user, name)),
          await s.expectError(() => nextStep(user, name, "x", null)),
          await s.expectError(() => visit(user, name, new Date())),
        ];
      },
    );
    Then("o banco recusa as três", () => {
      for (const e of errors) expect(e).not.toBeNull();
    });
  });

  Sc("Gestora também pode", ({ When, Then }) => {
    defines(When);
    nextStepIs(Then);
  });
});
