import { describe, expect, it } from "vitest";
import { unitLook } from "./look";
import { brasiliaNow, dateAtHour, sunAt } from "./sun";
import { viewDistance, viewPresets } from "./views";

describe("dateAtHour", () => {
  it("usa a hora de Brasília e transforma fração em minutos", () => {
    expect(dateAtHour("2026-06-21", 13.5).toISOString()).toBe("2026-06-21T16:30:00.000Z");
  });
  it("limita a hora ao dia", () => {
    expect(dateAtHour("2026-06-21", -2).toISOString()).toBe("2026-06-21T03:00:00.000Z");
    expect(dateAtHour("2026-06-21", 30).toISOString()).toBe("2026-06-22T02:59:00.000Z");
  });
});

describe("brasiliaNow", () => {
  it("devolve o dia e a hora de Brasília", () => {
    expect(brasiliaNow(new Date("2026-06-22T01:30:00Z"))).toEqual({
      day: "2026-06-21",
      hour: 22.5,
    });
  });
});

describe("sunAt", () => {
  it("à tarde o sol vem do oeste e a luz enfraquece perto do pôr do sol", () => {
    const loc = { lat: -23.55, lng: -46.63 };
    const afternoon = sunAt(loc, dateAtHour("2026-06-21", 16));
    const noon = sunAt(loc, dateAtHour("2026-06-21", 12));
    expect(afternoon.position[0]).toBeLessThan(0);
    expect(afternoon.intensity).toBeLessThan(noon.intensity);
    expect(afternoon.controllable).toBe(true);
  });
  it("à noite a luz do sol apaga", () => {
    expect(sunAt({ lat: -23.55, lng: -46.63 }, dateAtHour("2026-06-21", 2)).intensity).toBe(0);
  });
});

describe("viewPresets", () => {
  it("acompanha o modelo fora da origem", () => {
    const v = viewPresets({ width: 10, depth: 10, height: 20, base: [100, 5, -50] });
    expect(v.Frente.target).toEqual([100, 15, -50]);
    expect(v.Fundos.position[2]).toBeLessThan(-50);
    expect(v.Lateral.position[0]).toBeGreaterThan(100);
    expect(v.Cobertura.position[1]).toBeGreaterThan(25);
  });
  it("prédio largo afasta a câmera", () => {
    expect(viewDistance({ width: 200, depth: 20, height: 10 })).toBe(300);
  });
});

describe("unitLook", () => {
  it("a unidade escolhida aparece mesmo com 'Só disponíveis'", () => {
    const l = unitLook({ status: "sold", highlighted: true, onlyAvailable: true, night: false });
    expect(l.dimmed).toBe(false);
    expect(l.opacity).toBe(1);
    expect(l.emissiveIntensity).toBeGreaterThan(0.35);
  });
});
