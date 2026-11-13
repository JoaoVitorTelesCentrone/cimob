import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { STATUS_COLORS } from "../../src/layout";
import { unitLook } from "../../src/look";
import { dateAtHour, DEFAULT_SUN, sunAt, type Location, type Sun } from "../../src/sun";
import { VIEW_NAMES, viewPresets, type ViewName, type ViewPreset } from "../../src/views";

const feature = await loadFeature("../../features/site/sol-e-vistas.feature", { language: "pt" });

const SAO_PAULO: Location = { lat: -23.55, lng: -46.63 };

describeFeature(feature, ({ Background, Scenario }) => {
  let location: Location | null = null;
  let sun: Sun;
  let height = 0;
  let view: ViewPreset;
  let onlyAvailable = false;

  Background(({ Given }) => {
    Given("o empreendimento em São Paulo", () => {
      location = SAO_PAULO;
      onlyAvailable = false;
    });
  });

  const at = (_ctx: unknown, hour: number, day: string) => {
    sun = sunAt(location, dateAtHour(day, hour));
  };
  const STEP_HOUR = "a hora escolhida é {int}h de {string}";
  const [x, y, z] = [0, 1, 2] as const;

  Scenario("Ao meio-dia de inverno o sol fica alto e ao norte", ({ When, Then }) => {
    When(STEP_HOUR, at);
    Then("o sol está acima do horizonte e vem do norte", () => {
      expect(sun.night).toBe(false);
      expect(sun.position[y]).toBeGreaterThan(0);
      // Norte é -z na cena: no hemisfério sul, o sol do inverno passa ao norte.
      expect(sun.position[z]).toBeLessThan(0);
      expect(Math.abs(sun.position[z])).toBeGreaterThan(Math.abs(sun.position[x]));
    });
  });

  Scenario("De manhã o sol vem do leste", ({ When, Then }) => {
    When(STEP_HOUR, at);
    Then("o sol vem do leste", () => {
      expect(sun.position[x]).toBeGreaterThan(Math.abs(sun.position[z]));
    });
  });

  Scenario("À noite as janelas acendem", ({ When, Then }) => {
    When(STEP_HOUR, at);
    Then("é noite e as unidades brilham mais que de dia", () => {
      expect(sun.night).toBe(true);
      const look = (night: boolean) =>
        unitLook({ status: "available", highlighted: false, onlyAvailable: false, night });
      expect(look(true).emissiveIntensity).toBeGreaterThan(look(false).emissiveIntensity);
    });
  });

  Scenario("Sem localização na ficha, o sol não é inventado", ({ Given, When, Then }) => {
    Given("o empreendimento sem localização na ficha", () => {
      location = null;
    });
    When(STEP_HOUR, at);
    Then("o sol fica na posição padrão de dia e não há controle de hora", () => {
      expect(sun).toEqual(DEFAULT_SUN);
      expect(sun.night).toBe(false);
      expect(sun.controllable).toBe(false);
    });
  });

  Scenario("Vistas prontas enquadram o prédio", ({ Given, When, Then, And }) => {
    let presets: Record<ViewName, ViewPreset>;
    Given("um prédio de {int} andares", (_ctx: unknown, floors: number) => {
      height = floors * 3.2;
      presets = viewPresets({ width: 30, depth: 16, height });
    });
    When("o visitante escolhe a vista {string}", (_ctx: unknown, name: string) => {
      view = presets[name as ViewName];
    });
    Then("a câmera fica na frente do prédio, olhando para o meio dele", () => {
      // Frente é +z na cena.
      expect(view.position[z]).toBeGreaterThan(Math.abs(view.position[x]));
      expect(view.target).toEqual([0, height / 2, 0]);
    });
    And(
      "as vistas são {string}, {string}, {string}, {string} e {string}",
      (_ctx: unknown, ...names: string[]) => {
        expect(VIEW_NAMES).toEqual(names);
      },
    );
  });

  Scenario("Destacar só as disponíveis apaga as outras", ({ When, Then, And }) => {
    When('o visitante liga "Só disponíveis"', () => {
      onlyAvailable = true;
    });
    const look = (status: "available" | "sold") =>
      unitLook({ status, highlighted: false, onlyAvailable, night: false });
    Then("a unidade {string} continua com a cor do status", (_ctx: unknown, status: string) => {
      const l = look(status as "available");
      expect(l.dimmed).toBe(false);
      expect(l.emissive).toBe(STATUS_COLORS.available);
    });
    And("a unidade {string} fica apagada", (_ctx: unknown, status: string) => {
      const l = look(status as "sold");
      expect(l.dimmed).toBe(true);
      expect(l.emissiveIntensity).toBeLessThan(look("available").emissiveIntensity);
    });
  });
});
