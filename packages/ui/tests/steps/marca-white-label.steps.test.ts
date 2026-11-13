import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import {
  applyBrand,
  baseVars,
  brandCssVars,
  brandFromColor,
  contrastRatio,
  relativeLuminance,
  type Brand,
} from "../../src/index";

const feature = await loadFeature("../../features/site/marca-white-label.feature", {
  language: "pt",
});

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let brand: Brand;
  let error: Error | null;

  const choose = (hex: string) => {
    error = null;
    try {
      brand = brandFromColor(hex);
    } catch (e) {
      error = e as Error;
    }
  };

  Scenario("Cor com bom contraste é mantida", ({ When, Then, And }) => {
    When("a imobiliária escolhe a cor {string}", (_ctx, hex: string) => {
      choose(hex);
    });
    Then("a cor de marca é {string}", (_ctx, hex: string) => {
      expect(brand.brand).toBe(hex);
    });
    And("o texto sobre a marca tem contraste de pelo menos {number}", (_ctx, min: number) => {
      expect(contrastRatio(brand.brand, brand.onBrand)).toBeGreaterThanOrEqual(min);
    });
  });

  ScenarioOutline(
    "Cor clara demais é escurecida até ficar legível",
    ({ When, Then, And }, variables) => {
      When('a imobiliária escolhe a cor "<cor>"', () => {
        choose(variables.cor as string);
      });
      Then('a cor de marca é mais escura que "<cor>"', () => {
        expect(relativeLuminance(brand.brand)).toBeLessThan(
          relativeLuminance(variables.cor as string),
        );
      });
      And("o texto sobre a marca tem contraste de pelo menos {number}", (_ctx, min: number) => {
        expect(contrastRatio(brand.brand, brand.onBrand)).toBeGreaterThanOrEqual(min);
      });
    },
  );

  Scenario("Só as variáveis de marca mudam", ({ When, Then, And }) => {
    When("a imobiliária escolhe a cor {string}", (_ctx, hex: string) => {
      choose(hex);
    });
    Then(
      "o tema define apenas {string}, {string}, {string} e {string}",
      (_ctx, a: string, b: string, c: string, d: string) => {
        expect(Object.keys(brandCssVars(brand.brand)).sort()).toEqual([a, b, c, d].sort());
      },
    );
    And(
      "as cores de status disponível, reservado e vendido continuam as mesmas do design system",
      () => {
        const themed = applyBrand(baseVars("light"), brand.brand);
        for (const key of ["--available", "--reserved", "--sold"]) {
          expect(themed[key]).toBe(baseVars("light")[key]);
        }
      },
    );
  });

  Scenario("Cor inválida é recusada", ({ When, Then }) => {
    When("a imobiliária escolhe a cor {string}", (_ctx, hex: string) => {
      choose(hex);
    });
    Then("o sistema recusa a cor com a mensagem {string}", (_ctx, message: string) => {
      expect(error?.message).toBe(message);
    });
  });
});
