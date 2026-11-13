import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/organizacoes-rls.feature", {
  language: "pt",
});

describeFeature(
  feature,
  ({ Background, Scenario: Sc, ScenarioOutline, BeforeEachScenario, AfterEachScenario }) => {
    let s: Scenario;
    let orgNames: string[] = [];
    let memberRows: { organization_id: string }[] = [];
    let anonOrgs: readonly unknown[] = [];
    let anonMembers: readonly unknown[] = [];
    let updatedRows = -1;
    let role: string | null = null;

    BeforeEachScenario(() => {
      orgNames = [];
      memberRows = [];
      updatedRows = -1;
      role = null;
    });
    AfterEachScenario(async () => {
      await s.end();
    });

    const listOrgs = async (user: string) => {
      const rows = await s.as(user, (c) => c<{ name: string }[]>`select name from organizations`);
      orgNames = rows.map((r) => r.name);
    };
    const rename = async (user: string, org: string, name: string) => {
      const orgId = s.orgs.get(org) ?? "";
      const rows = await s.as(
        user,
        (c) => c`update organizations set name = ${name} where id = ${orgId} returning id`,
      );
      updatedRows = rows.length;
    };
    const nameOf = async (org: string) => {
      const orgId = s.orgs.get(org) ?? "";
      const [row] = await s.conn<
        { name: string }[]
      >`select name from organizations where id = ${orgId}`;
      return row?.name;
    };

    Background(({ Given, And }) => {
      Given("as organizações {string} e {string}", async (_ctx, a: string, b: string) => {
        s = await Scenario.begin();
        await s.org(a);
        await s.org(b);
      });
      And("{string} é gestora da {string}", async (_ctx, user: string, org: string) => {
        await s.member(user, org, "org_admin");
      });
      And("{string} é corretor da {string}", async (_ctx, user: string, org: string) => {
        await s.member(user, org, "agent");
      });
      And("{string} é gestor da {string}", async (_ctx, user: string, org: string) => {
        await s.member(user, org, "org_admin");
      });
    });

    Sc("Usuário vê só a própria organização", ({ When, Then, And }) => {
      When("{string} lista as organizações", async (_ctx, user: string) => {
        await listOrgs(user);
      });
      Then("aparece {string}", (_ctx, name: string) => {
        expect(orgNames).toContain(name);
      });
      And("não aparece {string}", (_ctx, name: string) => {
        expect(orgNames).not.toContain(name);
      });
    });

    Sc("Usuário não vê os membros de outra organização", ({ When, Then }) => {
      When("{string} lista os membros", async (_ctx, user: string) => {
        memberRows = await s.as(
          user,
          (c) => c<{ organization_id: string }[]>`select organization_id from memberships`,
        );
      });
      Then("aparecem apenas os membros da {string}", (_ctx, org: string) => {
        expect(memberRows.length).toBeGreaterThan(0);
        expect(memberRows.every((m) => m.organization_id === s.orgs.get(org))).toBe(true);
      });
    });

    Sc("Corretor não altera a organização", ({ When, Then, And }) => {
      When(
        "{string} tenta renomear a {string} para {string}",
        async (_ctx, user: string, org: string, name: string) => {
          await rename(user, org, name);
        },
      );
      Then("a alteração é negada", () => {
        expect(updatedRows).toBe(0);
      });
      And("a {string} continua com o nome {string}", async (_ctx, org: string, name: string) => {
        expect(await nameOf(org)).toBe(name);
      });
    });

    Sc("Gestor altera a própria organização", ({ When, Then }) => {
      When(
        "{string} tenta renomear a {string} para {string}",
        async (_ctx, user: string, org: string, name: string) => {
          await rename(user, org, name);
        },
      );
      Then("a {string} passa a se chamar {string}", async (_ctx, org: string, name: string) => {
        expect(await nameOf(org)).toBe(name);
      });
    });

    Sc("Gestor não altera outra organização", ({ When, Then, And }) => {
      When(
        "{string} tenta renomear a {string} para {string}",
        async (_ctx, user: string, org: string, name: string) => {
          await rename(user, org, name);
        },
      );
      Then("a alteração é negada", () => {
        expect(updatedRows).toBe(0);
      });
      And("a {string} continua com o nome {string}", async (_ctx, org: string, name: string) => {
        expect(await nameOf(org)).toBe(name);
      });
    });

    Sc("Membro desativado perde o acesso", ({ Given, When, Then }) => {
      Given("{string} foi desativado na {string}", async (_ctx, user: string, org: string) => {
        await s.deactivate(user, org);
      });
      When("{string} lista as organizações", async (_ctx, user: string) => {
        await listOrgs(user);
      });
      Then("não aparece {string}", (_ctx, name: string) => {
        expect(orgNames).not.toContain(name);
      });
    });

    ScenarioOutline("Papel do usuário na organização", ({ When, Then }, variables) => {
      When('consulto o papel de "<usuário>" na "<organização>"', async () => {
        const user = variables["usuário"] as string;
        const orgId = s.orgs.get(variables["organização"] as string) ?? "";
        const rows = await s.as(
          user,
          (c) => c<{ r: string | null }[]>`select role_in(${orgId}::uuid)::text as r`,
        );
        role = rows[0]?.r ?? null;
      });
      Then('o papel é "<papel>"', () => {
        expect(role ?? "nenhum").toBe(variables["papel"] as string);
      });
    });

    Sc("Visitante anônimo não lê organizações nem membros", ({ When, Then, And }) => {
      When("um visitante anônimo lista as organizações", async () => {
        anonOrgs = await s.as(null, (c) => c`select * from organizations`);
        anonMembers = await s.as(null, (c) => c`select * from memberships`);
      });
      Then("nenhuma organização aparece", () => {
        expect(anonOrgs).toHaveLength(0);
      });
      And("nenhum membro aparece", () => {
        expect(anonMembers).toHaveLength(0);
      });
    });
  },
);
