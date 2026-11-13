import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario, type Role } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/isolamento-tenant.feature", {
  language: "pt",
});

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let members: Set<string>;
  let seen: string[] = [];
  let events: string[] = [];
  let updated = -1;
  let anonError: string | null = null;
  let dbError: string | null = null;
  let created = false;

  AfterEachScenario(async () => {
    await s.end();
  });

  const ensureMember = async (user: string, org: string, role: Role) => {
    const key = `${user}|${org}`;
    if (members.has(key)) return;
    await s.member(user, org, role);
    members.add(key);
  };

  const listLeadsAs = async (user: string) => {
    const rows = await s.as(user, (c) => c<{ name: string }[]>`select name from leads`);
    seen = rows.map((r) => r.name);
  };
  const manager = async (org: string) => {
    const user = `Gestor ${org}`;
    await ensureMember(user, org, "org_admin");
    return user;
  };

  Background(({ Given, And }) => {
    Given("as imobiliárias {string} e {string}", async (_ctx, a: string, b: string) => {
      s = await Scenario.begin();
      members = new Set();
      seen = [];
      events = [];
      updated = -1;
      anonError = null;
      dbError = null;
      created = false;
      await s.org(a);
      await s.org(b);
    });
    And("o lead {string} pertence a {string}", async (_ctx, lead: string, org: string) => {
      await s.lead(org, lead, "5511999990001");
    });
  });

  const assign = async (lead: string, user: string, org: string) => {
    await ensureMember(user, org, "agent");
    await s.conn`update leads set owner_id = ${await s.user(user)}, assigned_at = now() where id = ${s.leads.get(lead) ?? ""}`;
  };
  const listAs = (user: string, org: string) => async () => {
    await ensureMember(user, org, "agent");
    await listLeadsAs(user);
  };
  const appears = (name: string) => {
    expect(seen).toContain(name);
  };
  const notAppears = (name: string) => {
    expect(seen).not.toContain(name);
  };

  Sc("Usuário de outra imobiliária não vê o lead", ({ When, Then }) => {
    When("o gestor da {string} lista os leads", async (_ctx, org: string) => {
      await listLeadsAs(await manager(org));
    });
    Then("{string} não aparece", (_ctx, name: string) => {
      notAppears(name);
    });
  });

  Sc("Corretor vê só os próprios leads", ({ Given, When, Then }) => {
    Given(
      "{string} atribuída a {string} da {string}",
      async (_ctx, l: string, u: string, o: string) => {
        await assign(l, u, o);
      },
    );
    When(
      "o corretor {string} da {string} lista os leads",
      async (_ctx, user: string, org: string) => {
        await listAs(user, org)();
      },
    );
    Then("{string} não aparece", (_ctx, name: string) => {
      notAppears(name);
    });
  });

  Sc("Corretor vê o lead atribuído a ele", ({ Given, When, Then }) => {
    Given(
      "{string} atribuída a {string} da {string}",
      async (_ctx, l: string, u: string, o: string) => {
        await assign(l, u, o);
      },
    );
    When(
      "o corretor {string} da {string} lista os leads",
      async (_ctx, user: string, org: string) => {
        await listAs(user, org)();
      },
    );
    Then("{string} aparece", (_ctx, name: string) => {
      appears(name);
    });
  });

  Sc("Lead ainda sem corretor só aparece para o gestor", ({ When, Then }) => {
    When(
      "o corretor {string} da {string} lista os leads",
      async (_ctx, user: string, org: string) => {
        await listAs(user, org)();
      },
    );
    Then("{string} não aparece", (_ctx, name: string) => {
      notAppears(name);
    });
  });

  Sc("Gestor vê todos os leads da própria imobiliária", ({ Given, When, Then }) => {
    Given(
      "{string} atribuída a {string} da {string}",
      async (_ctx, l: string, u: string, o: string) => {
        await assign(l, u, o);
      },
    );
    When("o gestor da {string} lista os leads", async (_ctx, org: string) => {
      await listLeadsAs(await manager(org));
    });
    Then("{string} aparece", (_ctx, name: string) => {
      appears(name);
    });
  });

  Sc("Visitante anônimo do site não acessa leads", ({ When, Then }) => {
    When("um visitante anônimo consulta os leads de {string}", async (_ctx, org: string) => {
      anonError = await s.expectError(() =>
        s.as(null, (c) => c`select * from leads where organization_id = ${s.orgId(org)}`),
      );
    });
    Then("o acesso é negado", () => {
      expect(anonError).toMatch(/permission denied/i);
    });
  });

  const moveLead = async (user: string, org: string, lead: string, stage: string) => {
    await ensureMember(user, org, "agent");
    const rows = await s.as(
      user,
      (c) =>
        c`update leads set stage = ${stage}::lead_stage where id = ${s.leads.get(lead) ?? ""} returning id`,
    );
    updated = rows.length;
  };

  Sc("Corretor não altera lead de outro corretor", ({ Given, When, Then }) => {
    Given(
      "{string} atribuída a {string} da {string}",
      async (_ctx, l: string, u: string, o: string) => {
        await assign(l, u, o);
      },
    );
    When(
      "o corretor {string} da {string} tenta mover {string} para {string}",
      async (_ctx, user: string, org: string, lead: string, stage: string) => {
        await moveLead(user, org, lead, stage);
      },
    );
    Then("a alteração é negada", () => {
      expect(updated).toBe(0);
    });
  });

  Sc("Corretor altera o próprio lead", ({ Given, When, Then }) => {
    Given(
      "{string} atribuída a {string} da {string}",
      async (_ctx, l: string, u: string, o: string) => {
        await assign(l, u, o);
      },
    );
    When(
      "o corretor {string} da {string} tenta mover {string} para {string}",
      async (_ctx, user: string, org: string, lead: string, stage: string) => {
        await moveLead(user, org, lead, stage);
      },
    );
    Then("{string} está no estágio {string}", async (_ctx, lead: string, stage: string) => {
      const [row] = await s.conn<
        { stage: string }[]
      >`select stage::text from leads where id = ${s.leads.get(lead) ?? ""}`;
      expect(row?.stage).toBe(stage);
    });
  });

  Sc("Histórico do lead fica oculto para quem não vê o lead", ({ Given, And, When, Then }) => {
    Given(
      "{string} atribuída a {string} da {string}",
      async (_ctx, l: string, u: string, o: string) => {
        await assign(l, u, o);
      },
    );
    And("{string} tem o evento {string}", async (_ctx, lead: string, type: string) => {
      const [row] = await s.conn<
        { organization_id: string }[]
      >`select organization_id from leads where id = ${s.leads.get(lead) ?? ""}`;
      await s.conn`insert into lead_events (organization_id, lead_id, type) values (${row?.organization_id ?? ""}, ${s.leads.get(lead) ?? ""}, ${type})`;
    });
    When(
      "o corretor {string} da {string} lista os eventos",
      async (_ctx, user: string, org: string) => {
        await ensureMember(user, org, "agent");
        const rows = await s.as(user, (c) => c<{ type: string }[]>`select type from lead_events`);
        events = rows.map((r) => r.type);
      },
    );
    Then("nenhum evento aparece", () => {
      expect(events).toHaveLength(0);
    });
  });

  Sc("Histórico do lead aparece para o corretor dono do lead", ({ Given, And, When, Then }) => {
    Given(
      "{string} atribuída a {string} da {string}",
      async (_ctx, l: string, u: string, o: string) => {
        await assign(l, u, o);
      },
    );
    And("{string} tem o evento {string}", async (_ctx, lead: string, type: string) => {
      const [row] = await s.conn<
        { organization_id: string }[]
      >`select organization_id from leads where id = ${s.leads.get(lead) ?? ""}`;
      await s.conn`insert into lead_events (organization_id, lead_id, type) values (${row?.organization_id ?? ""}, ${s.leads.get(lead) ?? ""}, ${type})`;
    });
    When(
      "o corretor {string} da {string} lista os eventos",
      async (_ctx, user: string, org: string) => {
        await ensureMember(user, org, "agent");
        const rows = await s.as(user, (c) => c<{ type: string }[]>`select type from lead_events`);
        events = rows.map((r) => r.type);
      },
    );
    Then("aparece o evento {string}", (_ctx, type: string) => {
      expect(events).toContain(type);
    });
  });

  Sc("Lead não pode apontar para unidade de outra imobiliária", ({ Given, When, Then }) => {
    Given("a unidade {string} pertence a {string}", async (_ctx, code: string, org: string) => {
      await s.development(org, `Empreendimento ${org}`, true);
      await s.unit(org, `Empreendimento ${org}`, code);
    });
    When(
      "o sistema vincula {string} à unidade {string}",
      async (_ctx, lead: string, code: string) => {
        dbError = await s.expectError(
          (c) =>
            c`update leads set unit_id = ${s.units.get(code) ?? ""} where id = ${s.leads.get(lead) ?? ""}`,
        );
      },
    );
    Then("o banco recusa o vínculo", () => {
      expect(dbError).toMatch(/violates foreign key constraint/i);
    });
  });

  const duplicatePhone = async (lead: string, org: string) => {
    const [row] = await s.conn<
      { phone: string }[]
    >`select phone from leads where id = ${s.leads.get(lead) ?? ""}`;
    dbError = await s.expectError(
      (c) =>
        c`insert into leads (organization_id, name, phone) values (${s.orgId(org)}, 'Outro', ${row?.phone ?? ""})`,
    );
    created = dbError === null;
  };

  Sc("Corretor não cria lead em outra imobiliária", ({ When, Then }) => {
    When(
      "o corretor {string} da {string} tenta criar um lead na {string}",
      async (_ctx, user: string, org: string, target: string) => {
        await ensureMember(user, org, "agent");
        const userId = await s.user(user);
        dbError = await s.expectError(() =>
          s.as(
            user,
            (c) =>
              c`insert into leads (organization_id, name, phone, owner_id) values (${s.orgId(target)}, 'Intruso', '5511999990099', ${userId})`,
          ),
        );
      },
    );
    Then("o banco recusa o lead", () => {
      expect(dbError).toMatch(/row-level security/i);
    });
  });

  Sc("Mesmo telefone na mesma imobiliária é recusado", ({ When, Then }) => {
    When(
      "o sistema cria outro lead com o telefone de {string} em {string}",
      async (_ctx, lead: string, org: string) => {
        await duplicatePhone(lead, org);
      },
    );
    Then("o banco recusa o lead", () => {
      expect(dbError).toMatch(/duplicate key|unique/i);
    });
  });

  Sc("Mesmo telefone em outra imobiliária é aceito", ({ When, Then }) => {
    When(
      "o sistema cria outro lead com o telefone de {string} em {string}",
      async (_ctx, lead: string, org: string) => {
        await duplicatePhone(lead, org);
      },
    );
    Then("o lead é criado", () => {
      expect(created).toBe(true);
    });
  });
});
