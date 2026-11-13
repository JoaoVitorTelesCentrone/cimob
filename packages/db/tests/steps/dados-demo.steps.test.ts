import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { DEMO_SLUG, removeDemo, seedDemo } from "../../src/demo.js";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/dados-demo.feature", {
  language: "pt",
});

const TABLES = ["organizations", "developments", "units", "properties", "leads"] as const;

describeFeature(feature, ({ Scenario: Sc, BeforeEachScenario, AfterEachScenario }) => {
  let s: Scenario;

  BeforeEachScenario(async () => {
    s = await Scenario.begin();
  });
  AfterEachScenario(async () => {
    await s.end();
  });

  const seed = async () => {
    await seedDemo(s.conn);
  };
  const count = async (query: string) => {
    const [row] = await s.conn.unsafe<{ n: string }[]>(query);
    return Number(row?.n ?? 0);
  };
  const demoOrgId = async () => {
    const [row] = await s.conn<
      { id: string }[]
    >`select id from organizations where slug = ${DEMO_SLUG}`;
    return row?.id ?? "";
  };

  Sc("O seed de demonstração marca tudo como demo", ({ When, Then, And }) => {
    When("o seed de demonstração roda", async () => {
      await seed();
    });
    Then("toda linha criada está marcada como demonstração", async () => {
      const orgId = await demoOrgId();
      expect(orgId).not.toBe("");
      let total = 0;
      for (const table of TABLES) {
        const column = table === "organizations" ? "id" : "organization_id";
        total += await count(`select count(*) n from ${table} where ${column} = '${orgId}'`);
        const unmarked = await count(
          `select count(*) n from ${table} where ${column} = '${orgId}' and not is_demo`,
        );
        expect(unmarked, `linhas sem is_demo em ${table}`).toBe(0);
      }
      expect(total).toBeGreaterThan(50);
    });
    And(
      "existe o empreendimento {string} com {int} unidades",
      async (_ctx, name: string, units: number) => {
        const [row] = await s.conn<{ n: string }[]>`
          select count(u.*) n from developments d join units u on u.development_id = d.id
          where d.name = ${name} and d.organization_id = ${await demoOrgId()}`;
        expect(Number(row?.n)).toBe(units);
      },
    );
  });

  Sc("A unidade de exemplo tem os números do protótipo", ({ When, Then }) => {
    When("o seed de demonstração roda", async () => {
      await seed();
    });
    Then(
      "a unidade {string} tem {int} m² e preço {string}",
      async (_ctx, code: string, area: number, price: string) => {
        const [row] = await s.conn<{ area_m2: string; price: string }[]>`
          select area_m2, price from units where code = ${code} and organization_id = ${await demoOrgId()}`;
        expect(Number(row?.area_m2)).toBe(area);
        expect(row?.price).toBe(price);
      },
    );
  });

  Sc("Rodar o seed duas vezes não duplica", ({ When, Then }) => {
    When("o seed de demonstração roda duas vezes", async () => {
      await seed();
      await seed();
    });
    Then("existe apenas uma organização de demonstração", async () => {
      expect(await count("select count(*) n from organizations where is_demo")).toBe(1);
    });
  });

  Sc("Limpar a demonstração preserva os dados reais", ({ Given, And, When, Then }) => {
    Given(
      "a organização real {string} com o lead {string}",
      async (_ctx, org: string, lead: string) => {
        await s.org(org);
        await s.lead(org, lead);
      },
    );
    And("o seed de demonstração rodou", async () => {
      await seed();
    });
    When("a demonstração é removida", async () => {
      await removeDemo(s.conn);
    });
    Then("nenhuma linha de demonstração resta", async () => {
      for (const table of TABLES) {
        expect(await count(`select count(*) n from ${table} where is_demo`), table).toBe(0);
      }
    });
    And(
      "a organização {string} e o lead {string} continuam",
      async (_ctx, org: string, lead: string) => {
        expect(
          await count(`select count(*) n from organizations where id = '${s.orgId(org)}'`),
        ).toBe(1);
        expect(
          await count(`select count(*) n from leads where id = '${s.leads.get(lead) ?? ""}'`),
        ).toBe(1);
      },
    );
  });
});
