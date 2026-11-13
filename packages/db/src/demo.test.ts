import { describe, expect, it } from "vitest";
import { DEMO_LOCATION, demoLeads, demoUnits } from "./demo.js";

describe("demoUnits", () => {
  const units = demoUnits();

  it("gera 10 andares x 4 posições, com códigos únicos", () => {
    expect(units).toHaveLength(40);
    expect(new Set(units.map((u) => u.code)).size).toBe(40);
  });

  it("a AUR-502 tem os números do protótipo: 82 m² e R$ 765.000", () => {
    const u = units.find((x) => x.code === "AUR-502");
    expect(u).toMatchObject({
      floor: 5,
      position: "02",
      areaM2: 82,
      price: 765000,
      meshName: "AUR-502",
    });
  });

  it("mistura os três status e a maioria está disponível", () => {
    const count = (s: string) => units.filter((u) => u.status === s).length;
    expect(count("available")).toBeGreaterThan(20);
    expect(count("reserved")).toBeGreaterThan(0);
    expect(count("sold")).toBeGreaterThan(0);
  });

  it("é determinístico", () => {
    expect(demoUnits()).toEqual(units);
  });
});

describe("demoLeads", () => {
  it("telefones são únicos e fictícios (faixa 5511 90000-xxxx)", () => {
    const leads = demoLeads();
    expect(new Set(leads.map((l) => l.phone)).size).toBe(leads.length);
    expect(leads.every((l) => l.phone.startsWith("551190000"))).toBe(true);
  });

  it("cobre mais de um estágio do funil", () => {
    expect(new Set(demoLeads().map((l) => l.stage)).size).toBeGreaterThan(3);
  });
});

describe("DEMO_LOCATION", () => {
  it("fica na Vila Mariana, em São Paulo (o sol do 3D usa)", () => {
    expect(DEMO_LOCATION.lat).toBeCloseTo(-23.59, 1);
    expect(DEMO_LOCATION.lng).toBeCloseTo(-46.63, 1);
  });
});
