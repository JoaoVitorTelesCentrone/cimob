import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { mapModel, type ModelMapping, type ModelUnit } from "../../src/model";

const feature = await loadFeature("../../features/site/modelo-glb.feature", { language: "pt" });

describeFeature(feature, ({ Background, Scenario }) => {
  let objects: string[] = [];
  let units: ModelUnit[] = [];
  let mapping: ModelMapping;

  Background(({ Given, And }) => {
    Given(
      "o modelo com os objetos {string}, {string}, {string} e {string}",
      (_ctx: unknown, ...names: string[]) => {
        objects = names;
      },
    );
    And("as unidades da ficha:", (_ctx, table: Record<string, string>[]) => {
      units = table.map((r) => ({
        code: r["código"] ?? "",
        meshName: r["mesh_name"] || null,
        status: (r["status"] ?? "available") as ModelUnit["status"],
      }));
    });
  });

  const link = (When: (t: string, f: () => void) => void) => {
    When("o modelo é ligado à ficha", () => {
      mapping = mapModel(objects, units);
    });
  };

  Scenario("Objeto com o nome da unidade vira a unidade", ({ When, Then, And }) => {
    link(When);
    const isUnit = (_ctx: unknown, object: string, code: string, color: string) => {
      expect(mapping.byObject.get(object)).toEqual({
        code,
        status: expect.any(String) as string,
        color,
      });
    };
    Then("o objeto {string} é a unidade {string} com a cor {string}", isUnit);
    And("o objeto {string} é a unidade {string} com a cor {string}", isUnit);
  });

  Scenario("O resto do modelo fica como veio", ({ When, Then }) => {
    link(When);
    Then("os objetos {string} e {string} não são unidades", (_ctx, a: string, b: string) => {
      expect(mapping.byObject.has(a)).toBe(false);
      expect(mapping.byObject.has(b)).toBe(false);
    });
  });

  Scenario("Unidade que não está no modelo fica fora do prédio", ({ When, Then }) => {
    link(When);
    Then(
      "{string} e {string} ficam na lista de unidades fora do prédio",
      (_ctx, a: string, b: string) => {
        expect(mapping.outside).toEqual([a, b]);
      },
    );
  });
});
