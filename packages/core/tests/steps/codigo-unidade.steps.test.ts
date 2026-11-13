import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { extractUnitCode } from "../../src/unit-code.ts";

const feature = await loadFeature("../../features/exemplo/codigo-unidade.feature", {
  language: "pt",
});

describeFeature(feature, ({ Scenario }) => {
  let result: string | null = null;

  Scenario("Reconhece o código no meio da mensagem", ({ When, Then }) => {
    When("o lead envia {string}", (_ctx, message: string) => {
      result = extractUnitCode(message);
    });
    Then("o código da unidade é {string}", (_ctx, code: string) => {
      expect(result).toBe(code);
    });
  });

  Scenario("Aceita minúsculas e normaliza", ({ When, Then }) => {
    When("o lead envia {string}", (_ctx, message: string) => {
      result = extractUnitCode(message);
    });
    Then("o código da unidade é {string}", (_ctx, code: string) => {
      expect(result).toBe(code);
    });
  });

  Scenario("Mensagem sem código é lead orgânico", ({ When, Then }) => {
    When("o lead envia {string}", (_ctx, message: string) => {
      result = extractUnitCode(message);
    });
    Then("nenhum código de unidade é reconhecido", () => {
      expect(result).toBeNull();
    });
  });
});
