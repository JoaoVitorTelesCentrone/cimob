import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import type { UnitStatus } from "@/lib/inventory";
import type { SiteUnit } from "@/lib/site/model";
import { unitCard, type UnitCard } from "@/lib/site/unit-card";

const feature = await loadFeature("../../features/site/card-unidade.feature", { language: "pt" });

/** "R$ 765.000" chega como {currency}; o valor vem só dos dígitos (sem centavos no site). */
const reais = (c: { raw: string }) => Number(c.raw.replace(/\D/g, ""));

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let development = "";
  let whatsapp: string | null = null;
  let card: UnitCard;

  const choose = (unit: SiteUnit) => {
    card = unitCard(unit, { development, whatsapp });
  };
  const decoded = () => {
    expect(card.action).not.toBeNull();
    const url = new URL(card.action?.url ?? "");
    return { phone: url.pathname.slice(1), text: url.searchParams.get("text") };
  };
  const texts = () => [card.title, card.statusLabel, ...card.facts, card.price ?? ""];

  Background(({ Given }) => {
    Given(
      "o {string} da imobiliária com WhatsApp {string}",
      (_ctx: unknown, name: string, phone: string) => {
        development = name;
        whatsapp = phone;
      },
    );
  });

  const STEP_CHOOSE =
    "o visitante escolhe a unidade {string} do {int}º andar, com {int} m², {int} dormitórios, {int} vagas, {currency} e {string}";
  const chooseFull = (
    _ctx: unknown,
    code: string,
    floor: number,
    area: number,
    bedrooms: number,
    parking: number,
    price: { raw: string },
    status: string,
  ) => {
    choose({
      code,
      floor,
      areaM2: area,
      bedrooms,
      parking,
      price: reais(price),
      status: status as UnitStatus,
    });
  };

  Scenario(
    'Unidade disponível mostra os dados da ficha e o "Quero essa"',
    ({ When, Then, And }) => {
      When(STEP_CHOOSE, chooseFull);
      Then(
        "o card mostra o título {string} e o status {string}",
        (_ctx: unknown, title: string, status: string) => {
          expect(card.title).toBe(title);
          expect(card.statusLabel).toBe(status);
        },
      );
      And(
        "o card mostra {string}, {string}, {string}, {string}, {string} e {string}",
        (_ctx: unknown, ...expected: string[]) => {
          expect(texts()).toEqual(expect.arrayContaining(expected));
        },
      );
      And(
        "o botão {string} abre o WhatsApp com {string}",
        (_ctx: unknown, label: string, text: string) => {
          expect(card.action?.label).toBe(label);
          expect(decoded()).toEqual({ phone: "5511900000000", text });
        },
      );
    },
  );

  ScenarioOutline(
    "Unidade que não está disponível não mostra preço e oferece parecidas",
    ({ When, Then, And }, variables) => {
      // No esquema, os parâmetros chegam como "<status>": os valores vêm da tabela de exemplos.
      const v = (key: string): string => {
        const value: unknown = (variables as Record<string, unknown>)[key];
        return typeof value === "string" ? value : "";
      };
      When(
        STEP_CHOOSE,
        (
          ctx: unknown,
          ...args: Parameters<typeof chooseFull> extends [unknown, ...infer R] ? R : never
        ) => {
          const [code, floor, area, bedrooms, parking, price] = args;
          chooseFull(ctx, code, floor, area, bedrooms, parking, price, v("status"));
        },
      );
      Then(
        "o card mostra o título {string} e o status {string}",
        (_ctx: unknown, title: string) => {
          expect(card.title).toBe(title);
          expect(card.statusLabel).toBe(v("rótulo"));
        },
      );
      And("o card não mostra preço", () => {
        expect(card.price).toBeNull();
        expect(texts().join(" ")).not.toContain("R$");
      });
      And("o botão {string} abre o WhatsApp com {string}", (_ctx: unknown, label: string) => {
        expect(card.action?.label).toBe(label);
        expect(decoded()).toEqual({
          phone: "5511900000000",
          text: `Olá! Vi que a unidade 703 do Residencial Aurora está ${v("situação")}. Quero ver opções parecidas. Código: AUR-703`,
        });
      });
    },
  );

  Scenario("Unidade sem preço na ficha não inventa preço", ({ When, Then, And }) => {
    When(
      "o visitante escolhe a unidade {string} do {int}º andar, sem preço e sem quartos na ficha",
      (_ctx: unknown, code: string, floor: number) => {
        choose({ code, floor, areaM2: 62, bedrooms: null, price: null, status: "available" });
      },
    );
    Then("o card não mostra preço", () => {
      expect(card.price).toBeNull();
      expect(texts().join(" ")).not.toContain("R$");
    });
    And("o card não fala de dormitórios", () => {
      expect(texts().join(" ")).not.toMatch(/dormit/);
    });
  });

  Scenario("Sem WhatsApp cadastrado, o card não tem botão", ({ Given, When, Then }) => {
    Given("a imobiliária está sem WhatsApp", () => {
      whatsapp = null;
    });
    When(STEP_CHOOSE, chooseFull);
    Then("o card não tem botão de WhatsApp", () => {
      expect(card.action).toBeNull();
    });
  });
});
