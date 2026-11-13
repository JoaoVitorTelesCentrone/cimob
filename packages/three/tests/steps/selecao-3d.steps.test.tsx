import ReactThreeTestRenderer from "@react-three/test-renderer";
import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { layoutBuilding, type UnitInput } from "../../src/layout";
import { ProceduralBuilding } from "../../src/ProceduralBuilding";

const feature = await loadFeature("../../features/site/selecao-3d.feature", { language: "pt" });

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

describeFeature(feature, ({ Background, Scenario }) => {
  let units: UnitInput[] = [];
  let selected: string | null = null;
  let onlyAvailable = false;
  let renderer: Renderer;

  const render = async () => {
    renderer = await ReactThreeTestRenderer.create(
      <ProceduralBuilding
        layout={layoutBuilding(units)}
        selected={selected}
        onlyAvailable={onlyAvailable}
        onSelect={(code) => {
          selected = code;
        }}
      />,
    );
  };
  const block = (code: string) => renderer.scene.findByProps({ name: code });
  const highlighted = (code: string) =>
    (block(code).instance.userData as { highlighted?: boolean }).highlighted === true;
  const dimmed = (code: string) =>
    (block(code).instance.userData as { dimmed?: boolean }).dimmed === true;

  Background(({ Given }) => {
    Given(
      "o prédio com as unidades {string}, {string} e {string}",
      async (_ctx, a: string, b: string, c: string) => {
        selected = null;
        onlyAvailable = false;
        units = [a, b, c].map((code) => ({
          code,
          floor: Number(code.slice(4, 5)),
          position: code.slice(5),
          status: "available" as const,
        }));
        await render();
      },
    );
  });

  Scenario("Clicar num bloco escolhe a unidade", ({ When, Then }) => {
    When("o visitante clica no bloco {string}", async (_ctx, code: string) => {
      await renderer.fireEvent(block(code), "onClick");
    });
    Then("a unidade escolhida é {string}", (_ctx, code: string) => {
      expect(selected).toBe(code);
    });
  });

  Scenario("Passar o mouse destaca o bloco", ({ When, Then, And }) => {
    When("o visitante passa o mouse no bloco {string}", async (_ctx, code: string) => {
      await renderer.fireEvent(block(code), "onPointerOver");
    });
    Then("o bloco {string} fica destacado", (_ctx, code: string) => {
      expect(highlighted(code)).toBe(true);
    });
    And("o bloco {string} não fica destacado", (_ctx, code: string) => {
      expect(highlighted(code)).toBe(false);
    });
  });

  Scenario("A unidade escolhida fica destacada", ({ Given, Then }) => {
    Given("a unidade {string} está escolhida", async (_ctx, code: string) => {
      selected = code;
      await render();
    });
    Then("o bloco {string} fica destacado", (_ctx, code: string) => {
      expect(highlighted(code)).toBe(true);
    });
  });

  Scenario(
    '"Só disponíveis" apaga no prédio as que não estão à venda',
    ({ Given, When, Then, And }) => {
      Given("a unidade {string} está vendida", (_ctx: unknown, code: string) => {
        units = units.map((u) => (u.code === code ? { ...u, status: "sold" as const } : u));
      });
      When('o visitante liga "Só disponíveis" no prédio', async () => {
        onlyAvailable = true;
        await render();
      });
      Then("o bloco {string} fica apagado", (_ctx: unknown, code: string) => {
        expect(dimmed(code)).toBe(true);
      });
      And("o bloco {string} não fica apagado", (_ctx: unknown, code: string) => {
        expect(dimmed(code)).toBe(false);
      });
    },
  );
});
