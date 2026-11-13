import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import {
  layoutBuilding,
  type BuildingLayout,
  type UnitBlock,
  type UnitInput,
} from "../../src/layout";

const feature = await loadFeature("../../features/site/predio-procedural.feature", {
  language: "pt",
});

type TableRow = Record<string, string>;

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let units: UnitInput[] = [];
  let building: BuildingLayout;

  const block = (code: string): UnitBlock => {
    const found = building.blocks.find((b) => b.code === code);
    if (!found) throw new Error(`bloco ausente: ${code}`);
    return found;
  };
  /** Dois blocos do mesmo andar se tocam se as caixas se cruzam em x e em z. */
  const touches = (a: UnitBlock, b: UnitBlock) =>
    Math.abs(a.position[0] - b.position[0]) < (a.size[0] + b.size[0]) / 2 &&
    Math.abs(a.position[2] - b.position[2]) < (a.size[2] + b.size[2]) / 2;
  const build = (When: (t: string, f: () => void) => void) => {
    When("o prédio é montado", () => {
      building = layoutBuilding(units);
    });
  };

  Background(({ Given }) => {
    Given("as unidades do empreendimento:", (_ctx, table: TableRow[]) => {
      units = table.map((r) => ({
        code: r["código"] ?? "",
        floor: r["andar"] ? Number(r["andar"]) : null,
        position: r["posição"] ?? null,
        status: (r["status"] ?? "available") as UnitInput["status"],
      }));
    });
  });

  Scenario("Cada unidade com andar vira um bloco com o código dela", ({ When, Then, And }) => {
    build(When);
    Then("o prédio tem {int} andares e {int} blocos", (_ctx, floors: number, blocks: number) => {
      expect(building.floors).toBe(floors);
      expect(building.blocks).toHaveLength(blocks);
    });
    And("o bloco {string} não existe", (_ctx, code: string) => {
      expect(building.blocks.some((b) => b.code === code)).toBe(false);
    });
    And(
      "o bloco {string} fica um andar acima do bloco {string}",
      (_ctx, upper: string, lower: string) => {
        const dy = block(upper).position[1] - block(lower).position[1];
        expect(dy).toBeCloseTo(building.floorHeight);
        expect(block(upper).position[0]).toBe(block(lower).position[0]);
        expect(block(upper).position[2]).toBe(block(lower).position[2]);
      },
    );
  });

  Scenario("Unidades do mesmo andar não se sobrepõem", ({ When, Then }) => {
    build(When);
    Then("nenhum bloco do mesmo andar encosta em outro", () => {
      for (const a of building.blocks) {
        for (const b of building.blocks) {
          if (a !== b && a.floor === b.floor)
            expect(touches(a, b), `${a.code} x ${b.code}`).toBe(false);
        }
      }
    });
  });

  Scenario("Unidade sem andar na ficha fica fora do prédio", ({ When, Then }) => {
    build(When);
    Then("{string} fica na lista de unidades fora do prédio", (_ctx, code: string) => {
      expect(building.outside).toEqual([code]);
    });
  });

  ScenarioOutline("As cores de status são fixas e não seguem a marca", ({ When, Then }, v) => {
    When('o prédio é montado com a cor de marca "#D4145A"', () => {
      // A cor de marca não entra no layout: só os tokens brand* são white label (regra 7).
      building = layoutBuilding(units);
    });
    Then('o bloco "<código>" tem a cor "<cor>"', () => {
      expect(block(String(v["código"])).color).toBe(String(v["cor"]));
    });
  });

  Scenario("O prédio cresce com o número de andares", ({ Given, When, Then }) => {
    Given(
      "um empreendimento com {int} andares de {int} unidades",
      (_ctx, floors: number, perFloor: number) => {
        units = Array.from({ length: floors * perFloor }, (_, i) => ({
          code: `X-${String(i)}`,
          floor: Math.floor(i / perFloor) + 1,
          position: String((i % perFloor) + 1).padStart(2, "0"),
          status: "available" as const,
        }));
      },
    );
    build(When);
    Then("a cobertura fica acima do {int}º andar", (_ctx, floor: number) => {
      const top = Math.max(
        ...building.blocks
          .filter((b) => b.floor === floor)
          .map((b) => b.position[1] + b.size[1] / 2),
      );
      expect(building.roofY).toBeGreaterThan(top);
    });
  });
});
