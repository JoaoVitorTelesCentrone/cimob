import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/crm/rodizio.feature", { language: "pt" });

const ORG = "Horizonte";
const ADMIN = "Paula";

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let dbError: string | null = null;

  AfterEachScenario(async () => {
    await s.end();
  });

  const userName = (id: string | null) =>
    [...s.users].find(([, userId]) => userId === id)?.[0] ?? null;
  const leadId = (name: string) => s.leads.get(name) ?? "";

  /** Sem usuário no JWT: é como o bot (service role) chama. */
  const asSystem = async () => {
    await s.conn`select set_config('request.jwt.claims', '', true)`;
  };
  const rotate = (lead: string) =>
    s.conn<
      { owner: string | null }[]
    >`select public.assign_lead_by_rotation(${leadId(lead)}) as owner`;
  const arrive = async (lead: string) => {
    await s.lead(ORG, lead);
    await asSystem();
    await rotate(lead);
  };
  const ownerOf = async (lead: string) => {
    const [row] = await s.conn<{ owner_id: string | null }[]>`
      select owner_id from leads where id = ${leadId(lead)}`;
    return userName(row?.owner_id ?? null);
  };
  const setRotation = (user: string, member: string, value: boolean) =>
    s.as(
      user,
      (c) => c`update memberships set in_rotation = ${value}
               where user_id = ${s.users.get(member) ?? ""} and organization_id = ${s.orgId(ORG)}`,
    );
  const inRotation = async (member: string) => {
    const [row] = await s.conn<{ in_rotation: boolean }[]>`
      select in_rotation from memberships
      where user_id = ${s.users.get(member) ?? ""} and organization_id = ${s.orgId(ORG)}`;
    return row?.in_rotation;
  };
  const tryRotateAs = async (user: string, lead: string) => {
    dbError = await s.expectError(() => s.as(user, () => rotate(lead)));
  };
  const expectOwners = async (expected: string[], leads: string[]) => {
    const owners = await Promise.all(leads.map(ownerOf));
    expect(owners).toEqual(expected);
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com a gestora {string}",
      async (_ctx, org: string, admin: string) => {
        s = await Scenario.begin();
        dbError = null;
        await s.org(org);
        await s.member(admin, org, "org_admin");
      },
    );
    And(
      "os corretores no rodízio {string}, {string} e {string}",
      async (_ctx, a: string, b: string, c: string) => {
        for (const name of [a, b, c]) {
          await s.member(name, ORG, "agent");
          await s.conn`update memberships set in_rotation = true, display_name = ${name}
                     where user_id = ${s.users.get(name) ?? ""}`;
        }
      },
    );
  });

  Sc("Distribui em ordem e volta ao começo", ({ When, Then }) => {
    const leads = ["L1", "L2", "L3", "L4"];
    When("chegam os leads {string}, {string}, {string} e {string}", async () => {
      for (const l of leads) await arrive(l);
    });
    Then(
      "os donos são {string}, {string}, {string} e {string}",
      async (_ctx, a: string, b: string, c: string, d: string) => {
        await expectOwners([a, b, c, d], leads);
      },
    );
  });

  Sc("Quem sai do rodízio não recebe e a vez segue", ({ Given, And, When, Then }) => {
    const leads = ["L2", "L3", "L4"];
    Given("o lead {string} foi distribuído", async (_ctx, lead: string) => {
      await arrive(lead);
    });
    And("a gestora tira {string} do rodízio", async (_ctx, member: string) => {
      await setRotation(ADMIN, member, false);
    });
    When("chegam os leads {string}, {string} e {string}", async () => {
      for (const l of leads) await arrive(l);
    });
    Then(
      "os donos são {string}, {string} e {string}",
      async (_ctx, a: string, b: string, c: string) => {
        await expectOwners([a, b, c], leads);
      },
    );
  });

  Sc("Corretor desativado não recebe", ({ Given, When, Then }) => {
    const leads = ["L1", "L2", "L3"];
    Given("{string} foi desativada", async (_ctx, member: string) => {
      await s.deactivate(member, ORG);
    });
    When("chegam os leads {string}, {string} e {string}", async () => {
      for (const l of leads) await arrive(l);
    });
    Then(
      "os donos são {string}, {string} e {string}",
      async (_ctx, a: string, b: string, c: string) => {
        await expectOwners([a, b, c], leads);
      },
    );
  });

  Sc("Nenhum corretor no rodízio deixa o lead sem dono", ({ Given, When, Then }) => {
    Given(
      "a gestora tira {string}, {string} e {string} do rodízio",
      async (_ctx, a: string, b: string, c: string) => {
        for (const m of [a, b, c]) await setRotation(ADMIN, m, false);
      },
    );
    When("chega o lead {string}", async (_ctx, lead: string) => {
      await arrive(lead);
    });
    Then("{string} fica sem dono", async (_ctx, lead: string) => {
      expect(await ownerOf(lead)).toBeNull();
    });
  });

  Sc("Distribuir registra o horário e o histórico", ({ When, Then, And }) => {
    When("chega o lead {string}", async (_ctx, lead: string) => {
      await arrive(lead);
    });
    Then(
      "{string} tem horário de atribuição e nenhuma resposta ainda",
      async (_ctx, lead: string) => {
        const [row] = await s.conn<{ assigned_at: Date | null; first_response_at: Date | null }[]>`
          select assigned_at, first_response_at from leads where id = ${leadId(lead)}`;
        expect(row?.assigned_at).toBeInstanceOf(Date);
        expect(row?.first_response_at).toBeNull();
      },
    );
    And(
      "{string} tem o evento {string} para {string} pelo rodízio",
      async (_ctx, lead: string, type: string, owner: string) => {
        const events = await s.conn<{ data: Record<string, unknown> }[]>`
          select data from lead_events where lead_id = ${leadId(lead)} and type = ${type}`;
        expect(events).toHaveLength(1);
        expect(events[0]?.data).toEqual({ to: s.users.get(owner), by: "rotation" });
      },
    );
  });

  Sc("Lead que já tem dono não é redistribuído", ({ Given, When, Then, And }) => {
    Given("o lead {string} já é de {string}", async (_ctx, lead: string, owner: string) => {
      await s.lead(ORG, lead, undefined, owner);
    });
    When("a gestora aciona o rodízio para {string}", async (_ctx, lead: string) => {
      await s.as(ADMIN, () => rotate(lead));
    });
    Then("{string} continua com {string}", async (_ctx, lead: string, owner: string) => {
      expect(await ownerOf(lead)).toBe(owner);
    });
    And("a próxima da vez continua sendo {string}", async (_ctx, next: string) => {
      await arrive("L2");
      expect(await ownerOf("L2")).toBe(next);
    });
  });

  Sc("Gestora vê quem é o próximo da vez", ({ Given, Then, And }) => {
    const nextAs = async (user: string) => {
      const [row] = await s.as(
        user,
        (c) =>
          c<{ next: string | null }[]>`select public.next_in_rotation(${s.orgId(ORG)}) as next`,
      );
      return userName(row?.next ?? null);
    };
    Given("o lead {string} foi distribuído", async (_ctx, lead: string) => {
      await arrive(lead);
    });
    Then("a gestora vê {string} como próximo da vez", async (_ctx, member: string) => {
      expect(await nextAs(ADMIN)).toBe(member);
    });
    And("{string} não vê quem é o próximo da vez", async (_ctx, member: string) => {
      expect(await nextAs(member)).toBeNull();
    });
  });

  Sc("Gestora aciona o rodízio pelo CRM", ({ Given, When, Then }) => {
    Given("o lead {string} sem dono", async (_ctx, lead: string) => {
      await s.lead(ORG, lead);
    });
    When("a gestora aciona o rodízio para {string}", async (_ctx, lead: string) => {
      const [row] = await s.as(ADMIN, () => rotate(lead));
      expect(userName(row?.owner ?? null)).toBe("Marina");
    });
    Then("{string} fica com {string}", async (_ctx, lead: string, owner: string) => {
      expect(await ownerOf(lead)).toBe(owner);
    });
  });

  Sc(
    "Visitante anônimo não aciona o rodízio nem vê o próximo da vez",
    ({ Given, When, Then, And }) => {
      let errors: (string | null)[] = [];
      Given("o lead {string} sem dono", async (_ctx, lead: string) => {
        await s.lead(ORG, lead);
      });
      When(
        "um visitante anônimo tenta acionar o rodízio para {string} e ver o próximo da vez",
        async (_ctx, lead: string) => {
          errors = [
            await s.expectError(() => s.as(null, () => rotate(lead))),
            await s.expectError(() =>
              s.as(null, (c) => c`select public.next_in_rotation(${s.orgId(ORG)})`),
            ),
          ];
        },
      );
      Then("o acesso é negado nas duas", () => {
        for (const e of errors) expect(e).toMatch(/permission denied/);
      });
      And("{string} fica sem dono", async (_ctx, lead: string) => {
        expect(await ownerOf(lead)).toBeNull();
      });
    },
  );

  Sc("Corretor não aciona o rodízio", ({ Given, When, Then, And }) => {
    Given("o lead {string} sem dono", async (_ctx, lead: string) => {
      await s.lead(ORG, lead);
    });
    When(
      "{string} tenta acionar o rodízio para {string}",
      async (_ctx, user: string, lead: string) => {
        await tryRotateAs(user, lead);
      },
    );
    Then("o banco recusa", () => {
      expect(dbError).not.toBeNull();
    });
    And("{string} fica sem dono", async (_ctx, lead: string) => {
      expect(await ownerOf(lead)).toBeNull();
    });
  });

  Sc("Gestora de outra imobiliária não aciona o rodízio", ({ Given, And, When, Then }) => {
    Given(
      "a imobiliária {string} com a gestora {string}",
      async (_ctx, org: string, admin: string) => {
        await s.org(org);
        await s.member(admin, org, "org_admin");
      },
    );
    And("o lead {string} sem dono", async (_ctx, lead: string) => {
      await s.lead(ORG, lead);
    });
    When(
      "{string} tenta acionar o rodízio para {string}",
      async (_ctx, user: string, lead: string) => {
        await tryRotateAs(user, lead);
      },
    );
    Then("o banco recusa", () => {
      expect(dbError).not.toBeNull();
    });
    And("{string} fica sem dono", async (_ctx, lead: string) => {
      expect(await ownerOf(lead)).toBeNull();
    });
  });

  Sc("Gestora tira e põe corretor no rodízio", ({ When, Then }) => {
    When("a gestora tira {string} do rodízio", async (_ctx, member: string) => {
      await setRotation(ADMIN, member, false);
    });
    Then("{string} está fora do rodízio", async (_ctx, member: string) => {
      expect(await inRotation(member)).toBe(false);
    });
    When("a gestora põe {string} no rodízio", async (_ctx, member: string) => {
      await setRotation(ADMIN, member, true);
    });
    Then("{string} está no rodízio", async (_ctx, member: string) => {
      expect(await inRotation(member)).toBe(true);
    });
  });

  Sc("Corretor não muda o próprio rodízio", ({ When, Then }) => {
    When("{string} tenta sair do rodízio", async (_ctx, member: string) => {
      await s.expectError(() => setRotation(member, member, false));
    });
    Then("{string} está no rodízio", async (_ctx, member: string) => {
      expect(await inRotation(member)).toBe(true);
    });
  });

  Sc("Gestora não muda outros dados da equipe pelo app", ({ When, Then }) => {
    When(
      "a gestora tenta mudar o papel de {string} para {string}",
      async (_ctx, member: string, role: string) => {
        dbError = await s.expectError(() =>
          s.as(
            ADMIN,
            (c) => c`update memberships set role = ${role}::membership_role
                     where user_id = ${s.users.get(member) ?? ""}`,
          ),
        );
      },
    );
    Then("o banco recusa", () => {
      expect(dbError).not.toBeNull();
    });
  });
});
