import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { planUnitEdit, type UnitEditPlan } from "@/lib/unit-edit";

const feature = await loadFeature("../../features/crm/editar-unidade.feature", { language: "pt" });

type TableRow = Record<string, string>;
const FIELD: Record<string, string> = {
  andar: "floor",
  área: "areaM2",
  quartos: "bedrooms",
  vagas: "parking",
  preço: "price",
};

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let plan: UnitEditPlan;

  const given = (Given: (t: string, f: () => void) => void) => {
    Given(
      "a unidade {string} com andar {string}, área {string}, quartos {string}, vagas {string} e preço {string}",
      () => undefined,
    );
  };
  const save = (canEdit: boolean, floor: string, area: string, bedrooms: string, parking: string, price: string) => {
    plan = planUnitEdit({ canEdit, raw: { floor, areaM2: area, bedrooms, parking, price } });
  };
  type Step5 = (
    t: string,
    f: (c: unknown, a: string, b: string, d: string, e: string, g: string) => void,
  ) => void;
  const saves = (When: Step5) => {
    When(
      "a gestora salva andar {string}, área {string}, quartos {string}, vagas {string} e preço {string}",
      (_ctx, f, a, b, p, pr) => {
        save(true, f, a, b, p, pr);
      },
    );
  };
  const refused = (Then: (t: string, f: (c: unknown, message: string) => void) => void) => {
    Then("nada é gravado e aparece {string}", (_ctx, message) => {
      expect(plan).toEqual({ kind: "error", message });
    });
  };

  Scenario("Gestora corrige o preço e a área", ({ Given, When, Then }) => {
    given(Given);
    saves(When);
    Then("a unidade é gravada com:", (_ctx, table: TableRow[]) => {
      expect(plan.kind).toBe("save");
      const patch = plan.kind === "save" ? (plan.patch as Record<string, unknown>) : {};
      for (const r of table) expect(patch[FIELD[r["campo"] ?? ""] ?? ""]).toBe(Number(r["valor"]));
    });
  });

  Scenario("Preço em branco tira o preço da unidade", ({ Given, When, Then }) => {
    given(Given);
    saves(When);
    Then("a unidade é gravada sem preço", () => {
      expect(plan).toMatchObject({ kind: "save", patch: { price: null } });
    });
  });

  ScenarioOutline("Valor inválido é recusado com a mensagem certa", ({ Given, When, Then }, vars) => {
    given(Given);
    When(
      "a gestora salva andar {string}, área {string}, quartos {string}, vagas {string} e preço {string}",
      () => {
        save(
          true,
          vars["andar"] as string,
          vars["área"] as string,
          vars["quartos"] as string,
          vars["vagas"] as string,
          vars["preço"] as string,
        );
      },
    );
    Then("nada é gravado e aparece {string}", () => {
      expect(plan).toEqual({ kind: "error", message: vars["mensagem"] as string });
    });
  });

  Scenario("Corretora não edita a unidade", ({ Given, When, Then }) => {
    given(Given);
    When("a corretora tenta salvar preço {string}", (_ctx, price: string) => {
      save(false, "5", "68,50", "2", "1", price);
    });
    refused(Then);
  });
});
