import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { applyUnitChange } from "@/lib/site/live";
import type { SiteUnit } from "@/lib/site/model";
import { unitCard } from "@/lib/site/unit-card";

const feature = await loadFeature("../../features/site/status-ao-vivo.feature", { language: "pt" });

describeFeature(feature, ({ Background, Scenario }) => {
  let units: SiteUnit[] = [];

  const card = (code: string) => {
    const unit = units.find((u) => u.code === code);
    if (!unit) throw new Error(`unidade ${code} fora da tela`);
    return unitCard(unit, { development: "Residencial Aurora", whatsapp: "5511900000000" });
  };

  Background(({ Given }) => {
    Given(
      "o site mostrando a unidade {string} disponível por {currency}",
      (_ctx: unknown, code: string, price: { raw: string }) => {
        units = [
          {
            code,
            floor: 5,
            areaM2: 82,
            bedrooms: 3,
            price: Number(price.raw.replace(/\D/g, "")),
            status: "available",
          },
        ];
      },
    );
  });

  const arrives = (_ctx: unknown, code: string, status: string) => {
    // Formato do Supabase Realtime (postgres_changes, UPDATE).
    units = applyUnitChange(units, { eventType: "UPDATE", new: { code, status } });
  };
  const STEP_ARRIVES = "chega do Realtime que {string} ficou {string}";
  const stays = (_ctx: unknown, code: string, label: string) => {
    expect(card(code).statusLabel).toBe(label);
    expect(card(code).price).toBe("R$ 765.000");
  };

  Scenario("Unidade reservada no CRM muda no site", ({ When, Then }) => {
    When(STEP_ARRIVES, arrives);
    Then(
      "o card de {string} mostra {string}, sem preço e com {string}",
      (_ctx: unknown, code: string, label: string, action: string) => {
        const c = card(code);
        expect(c.statusLabel).toBe(label);
        expect(c.price).toBeNull();
        expect(c.action?.label).toBe(action);
      },
    );
  });

  Scenario("Mudança de unidade que não está na tela não mexe no card", ({ When, Then }) => {
    When(STEP_ARRIVES, arrives);
    Then("o card de {string} continua {string}", stays);
  });

  Scenario("Status desconhecido é ignorado", ({ When, Then }) => {
    When(STEP_ARRIVES, arrives);
    Then("o card de {string} continua {string}", stays);
  });
});
