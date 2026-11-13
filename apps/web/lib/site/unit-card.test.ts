import { describe, expect, it } from "vitest";
import { floorLabel, unitCard, unitNumber } from "./unit-card";

describe("unitNumber", () => {
  it("usa o que vem depois do último hífen", () => {
    expect(unitNumber("AUR-502")).toBe("502");
    expect(unitNumber("TORRE-B-1201")).toBe("1201");
  });
  it("sem hífen, usa o código inteiro", () => {
    expect(unitNumber("502")).toBe("502");
  });
});

describe("floorLabel", () => {
  it("andar 0 é o térreo; sem andar não diz nada", () => {
    expect(floorLabel(0)).toBe("Térreo");
    expect(floorLabel(5)).toBe("5º andar");
    expect(floorLabel(null)).toBeNull();
    expect(floorLabel(undefined)).toBeNull();
  });
});

describe("unitCard", () => {
  const ctx = { development: "Residencial Aurora", whatsapp: "5511900000000" };

  it("singular para 1 dormitório e 1 vaga", () => {
    const card = unitCard(
      {
        code: "AUR-101",
        floor: 1,
        areaM2: 40,
        bedrooms: 1,
        parking: 1,
        price: null,
        status: "available",
      },
      ctx,
    );
    expect(card.facts).toEqual(["AUR-101", "40 m²", "1 dormitório", "1 vaga", "1º andar"]);
  });

  it("sem vaga na ficha (null) não fala de vaga; zero vaga diz 'Sem vaga'", () => {
    const base = {
      code: "AUR-101",
      areaM2: null,
      bedrooms: null,
      price: null,
      status: "available",
    } as const;
    expect(unitCard({ ...base, parking: null }, ctx).facts).toEqual(["AUR-101"]);
    expect(unitCard({ ...base, parking: 0 }, ctx).facts).toEqual(["AUR-101", "Sem vaga"]);
  });

  it("o status vem com o código de cor fixo", () => {
    const card = unitCard(
      { code: "AUR-703", bedrooms: null, areaM2: null, price: 990000, status: "reserved" },
      ctx,
    );
    expect(card.status).toBe("reserved");
    expect(card.price).toBeNull();
  });
});
