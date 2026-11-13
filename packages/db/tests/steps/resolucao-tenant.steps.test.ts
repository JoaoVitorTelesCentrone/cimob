import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/resolucao-tenant.feature", {
  language: "pt",
});

type Row = Record<string, unknown>;

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let rows: readonly Row[] = [];

  AfterEachScenario(async () => {
    await s.end();
  });

  const resolve = async (slug: string | null, domain: string | null) => {
    rows = await s.as(
      null,
      (c) => c<Row[]>`select * from public.resolve_tenant(${slug}, ${domain})`,
    );
  };

  Background(({ Given }) => {
    Given(
      "a organização {string} com o domínio próprio {string}",
      async (_ctx, name: string, domain: string) => {
        s = await Scenario.begin();
        await s.org(name, { slug: name.toLowerCase(), customDomain: domain });
      },
    );
  });

  Sc("Anônimo resolve pelo subdomínio", ({ When, Then }) => {
    When("um visitante anônimo resolve o subdomínio {string}", async (_ctx, slug: string) => {
      await resolve(slug, null);
    });
    Then("recebe a organização {string}", (_ctx, name: string) => {
      expect(rows.map((r) => r["name"])).toEqual([name]);
    });
  });

  Sc("Anônimo resolve pelo domínio próprio", ({ When, Then }) => {
    When("um visitante anônimo resolve o domínio {string}", async (_ctx, domain: string) => {
      await resolve(null, domain);
    });
    Then("recebe a organização {string}", (_ctx, name: string) => {
      expect(rows.map((r) => r["name"])).toEqual([name]);
    });
  });

  Sc("Imobiliária inexistente não devolve nada", ({ When, Then }) => {
    When("um visitante anônimo resolve o subdomínio {string}", async (_ctx, slug: string) => {
      await resolve(slug, null);
    });
    Then("não recebe nenhuma organização", () => {
      expect(rows).toHaveLength(0);
    });
  });

  Sc("A resposta expõe só dados públicos", ({ When, Then }) => {
    When("um visitante anônimo resolve o subdomínio {string}", async (_ctx, slug: string) => {
      await resolve(slug, null);
    });
    Then(
      "a resposta tem apenas {string}, {string}, {string} e {string}",
      (_ctx, a: string, b: string, c: string, d: string) => {
        expect(Object.keys(rows[0] ?? {}).sort()).toEqual([a, b, c, d].sort());
      },
    );
  });

  Sc("Consultar sem informar nada não devolve nada", ({ When, Then }) => {
    When("um visitante anônimo resolve sem informar subdomínio nem domínio", async () => {
      await resolve(null, null);
    });
    Then("não recebe nenhuma organização", () => {
      expect(rows).toHaveLength(0);
    });
  });
});
