import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/dados-do-site-rls.feature", {
  language: "pt",
});

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let devNames: string[] = [];
  let unitCodes: string[] = [];
  let propCodes: string[] = [];
  let updated = -1;
  let dbError: string | null = null;

  AfterEachScenario(async () => {
    await s.end();
  });

  const listSite = async (user: string | null) => {
    devNames = (await s.as(user, (c) => c<{ name: string }[]>`select name from developments`)).map(
      (r) => r.name,
    );
    unitCodes = (await s.as(user, (c) => c<{ code: string }[]>`select code from units`)).map(
      (r) => r.code,
    );
  };
  const listProps = async (user: string | null) => {
    propCodes = [];
    // O anônimo nem tem acesso à tabela: "permission denied" conta como lista vazia.
    const error = await s.expectError(async () => {
      const rows = await s.as(user, (c) => c<{ code: string }[]>`select code from properties`);
      propCodes = rows.map((r) => r.code);
    });
    if (error && !/permission denied/i.test(error)) throw new Error(error);
  };
  const setStatus = async (user: string | null, code: string, status: string) => {
    const rows = await s.as(
      user,
      (c) =>
        c`update units set status = ${status}::unit_status where id = ${s.units.get(code) ?? ""} returning id`,
    );
    updated = rows.length;
  };
  const statusOf = async (code: string) => {
    const [row] = await s.conn<
      { status: string }[]
    >`select status::text from units where id = ${s.units.get(code) ?? ""}`;
    return row?.status;
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com o empreendimento {string} publicado e a unidade {string}",
      async (_ctx, org: string, dev: string, code: string) => {
        s = await Scenario.begin();
        updated = -1;
        dbError = null;
        await s.org(org);
        await s.development(org, dev, true);
        await s.unit(org, dev, code);
      },
    );
    And(
      "a imobiliária {string} com o empreendimento {string} não publicado e a unidade {string}",
      async (_ctx, org: string, dev: string, code: string) => {
        await s.org(org);
        await s.development(org, dev, false);
        await s.unit(org, dev, code);
      },
    );
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

  Sc("Visitante anônimo vê só o que está publicado", ({ When, Then, And }) => {
    When("um visitante anônimo lista os empreendimentos e as unidades", async () => {
      await listSite(null);
    });
    Then(
      "aparecem o empreendimento {string} e a unidade {string}",
      (_ctx, dev: string, code: string) => {
        expect(devNames).toContain(dev);
        expect(unitCodes).toContain(code);
      },
    );
    And(
      "não aparecem o empreendimento {string} nem a unidade {string}",
      (_ctx, dev: string, code: string) => {
        expect(devNames).not.toContain(dev);
        expect(unitCodes).not.toContain(code);
      },
    );
  });

  Sc("Gestor vê os rascunhos da própria imobiliária", ({ When, Then }) => {
    When("{string} lista os empreendimentos e as unidades", async (_ctx, user: string) => {
      await listSite(user);
    });
    Then(
      "aparecem o empreendimento {string} e a unidade {string}",
      (_ctx, dev: string, code: string) => {
        expect(devNames).toContain(dev);
        expect(unitCodes).toContain(code);
      },
    );
  });

  Sc("Corretor de outra imobiliária não vê o rascunho", ({ When, Then }) => {
    When("{string} lista os empreendimentos e as unidades", async (_ctx, user: string) => {
      await listSite(user);
    });
    Then(
      "não aparecem o empreendimento {string} nem a unidade {string}",
      (_ctx, dev: string, code: string) => {
        expect(devNames).not.toContain(dev);
        expect(unitCodes).not.toContain(code);
      },
    );
  });

  Sc("Visitante anônimo não lê imóveis avulsos", ({ Given, When, Then }) => {
    Given("o imóvel {string} da {string}", async (_ctx, code: string, org: string) => {
      await s.property(org, code);
    });
    When("um visitante anônimo lista os imóveis", async () => {
      await listProps(null);
    });
    Then("nenhum imóvel aparece", () => {
      expect(propCodes).toHaveLength(0);
    });
  });

  Sc("Corretor lê os imóveis da própria imobiliária", ({ Given, When, Then }) => {
    Given("o imóvel {string} da {string}", async (_ctx, code: string, org: string) => {
      await s.property(org, code);
    });
    When("{string} lista os imóveis", async (_ctx, user: string) => {
      await listProps(user);
    });
    Then("aparece o imóvel {string}", (_ctx, code: string) => {
      expect(propCodes).toContain(code);
    });
  });

  Sc("Gestor altera o status da unidade", ({ When, Then }) => {
    When(
      "{string} marca a unidade {string} como {string}",
      async (_ctx, user: string, code: string, st: string) => {
        await setStatus(user, code, st);
      },
    );
    Then("a unidade {string} está {string}", async (_ctx, code: string, st: string) => {
      expect(await statusOf(code)).toBe(st);
    });
  });

  const deniedScenario = (name: string, who: "named" | "anon"): void => {
    Sc(name, ({ When, Then, And }) => {
      if (who === "named") {
        When(
          "{string} marca a unidade {string} como {string}",
          async (_ctx, user: string, code: string, st: string) => {
            await setStatus(user, code, st);
          },
        );
      } else {
        When(
          "um visitante anônimo marca a unidade {string} como {string}",
          async (_ctx, code: string, st: string) => {
            await setStatus(null, code, st);
          },
        );
      }
      Then("a alteração é negada", () => {
        expect(updated).toBe(0);
      });
      And("a unidade {string} está {string}", async (_ctx, code: string, st: string) => {
        expect(await statusOf(code)).toBe(st);
      });
    });
  };

  deniedScenario("Corretor não altera o status da unidade", "named");
  deniedScenario("Gestor de outra imobiliária não altera a unidade", "named");
  deniedScenario("Visitante anônimo não altera a unidade", "anon");

  const createUnit = async (code: string, org: string, dev: string) => {
    dbError = await s.expectError(
      (c) =>
        c`insert into units (organization_id, development_id, code) values (${s.orgId(org)}, ${s.devs.get(dev) ?? ""}, ${code})`,
    );
  };

  Sc("Unidade não pode apontar para empreendimento de outra imobiliária", ({ When, Then }) => {
    When(
      "o sistema cria a unidade {string} da {string} no empreendimento {string}",
      async (_ctx, code: string, org: string, dev: string) => {
        await createUnit(code, org, dev);
      },
    );
    Then("o banco recusa a unidade", () => {
      expect(dbError).toMatch(/violates foreign key constraint/i);
    });
  });

  Sc("Código de unidade é único dentro da imobiliária", ({ When, Then }) => {
    When(
      "o sistema cria a unidade {string} da {string} no empreendimento {string}",
      async (_ctx, code: string, org: string, dev: string) => {
        await createUnit(code, org, dev);
      },
    );
    Then("o banco recusa a unidade", () => {
      expect(dbError).toMatch(/duplicate key|unique/i);
    });
  });
});
