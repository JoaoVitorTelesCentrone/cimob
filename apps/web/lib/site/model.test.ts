import { describe, expect, it } from "vitest";
import {
  availabilityLabel,
  buildingOf,
  buildSite,
  cardsOf,
  deliveryLabel,
  plansLabel,
  type SiteUnit,
} from "./model";

const unit = (over: Partial<SiteUnit>): SiteUnit => ({
  code: "A-1",
  bedrooms: 2,
  areaM2: 60,
  price: 500_000,
  status: "available",
  ...over,
});

describe("deliveryLabel", () => {
  it("mês abreviado e ano", () => {
    expect(deliveryLabel("2028-12-01", new Date("2026-11-13"))).toBe("Entrega dez/2028");
    expect(deliveryLabel("2027-03-15", new Date("2026-11-13"))).toBe("Entrega mar/2027");
  });

  it("data passada vira pronto para morar; sem data, nada", () => {
    expect(deliveryLabel("2025-01-01", new Date("2026-11-13"))).toBe("Pronto para morar");
    expect(deliveryLabel(null, new Date())).toBeNull();
  });
});

describe("plansLabel", () => {
  it("quartos e faixa de área de todas as unidades", () => {
    expect(plansLabel([unit({ bedrooms: 3, areaM2: 82 }), unit({ bedrooms: 2, areaM2: 58 })])).toBe(
      "2 e 3 dormitórios, de 58 a 82 m²",
    );
    expect(plansLabel([unit({ bedrooms: 1 }), unit({ bedrooms: 2 }), unit({ bedrooms: 3 })])).toBe(
      "1, 2 e 3 dormitórios, de 60 m²",
    );
  });

  it("um quarto só e área única", () => {
    expect(plansLabel([unit({ bedrooms: 1, areaM2: 45.5 })])).toBe("1 dormitório, de 45,5 m²");
  });

  it("sem dado na ficha, mostra só o que tem (ou nada)", () => {
    expect(plansLabel([unit({ bedrooms: null })])).toBe("de 60 m²");
    expect(plansLabel([unit({ bedrooms: 2, areaM2: null })])).toBe("2 dormitórios");
    expect(plansLabel([unit({ bedrooms: null, areaM2: null })])).toBeNull();
    expect(plansLabel([])).toBeNull();
  });
});

describe("availabilityLabel", () => {
  it("plural e singular", () => {
    expect(availabilityLabel(2)).toBe("2 unidades disponíveis");
    expect(availabilityLabel(1)).toBe("1 unidade disponível");
    expect(availabilityLabel(0)).toBe("Nenhuma unidade disponível no momento");
  });
});

describe("buildSite", () => {
  const brand = { name: "Horizonte", creci: null, whatsapp: "5511900000000" };

  it("o primeiro empreendimento é o destaque; os outros vão para a lista", () => {
    const dev = (id: string) => ({
      id,
      name: id,
      address: null,
      deliveryDate: null,
      isDemo: false,
      units: [],
    });
    const site = buildSite(brand, [dev("A"), dev("B"), dev("C")]);
    expect(site.featured?.name).toBe("A");
    expect(site.others.map((d) => d.name)).toEqual(["B", "C"]);
  });

  it("sem CRECI, o rodapé mostra só o nome", () => {
    expect(buildSite(brand, []).footer).toEqual(["Horizonte", "Site por Center One"]);
  });

  it("WhatsApp geral do cabeçalho fala com a imobiliária", () => {
    const url = new URL(buildSite(brand, []).whatsappUrl ?? "");
    expect(url.searchParams.get("text")).toBe("Olá! Vi o site da Horizonte e quero saber mais.");
  });

  it("resumo sem endereço nem entrega fica vazio", () => {
    const site = buildSite(brand, [
      { id: "A", name: "A", address: null, deliveryDate: null, isDemo: false, units: [] },
    ]);
    expect(site.featured?.summary).toBe("");
  });
});

describe("buildSite: prédio 3D", () => {
  it("leva código, andar, posição, objeto do modelo e status de cada unidade", () => {
    const site = buildSite({ name: "H", creci: null, whatsapp: null }, [
      {
        id: "A",
        name: "A",
        address: null,
        deliveryDate: null,
        isDemo: false,
        units: [
          unit({ code: "A-101", floor: 1, position: "01", status: "sold", meshName: "Apto_101" }),
          unit({ code: "A-T" }),
        ],
      },
    ]);
    expect(buildingOf(site.featured?.units ?? [])).toEqual([
      { code: "A-101", floor: 1, position: "01", status: "sold", meshName: "Apto_101" },
      { code: "A-T", floor: null, position: null, status: "available", meshName: null },
    ]);
    expect(site.featured?.modelUrl).toBeNull();
  });

  it("usa o modelo do arquiteto quando o empreendimento tem um", () => {
    const site = buildSite({ name: "H", creci: null, whatsapp: null }, [
      {
        id: "A",
        name: "A",
        address: null,
        deliveryDate: null,
        isDemo: false,
        modelUrl: "https://cdn.exemplo/aurora.glb",
        units: [],
      },
    ]);
    expect(site.featured?.modelUrl).toBe("https://cdn.exemplo/aurora.glb");
  });

  it("leva a localização só quando a ficha tem lat e lng", () => {
    const dev = (lat: number | null, lng: number | null) =>
      buildSite({ name: "H", creci: null, whatsapp: null }, [
        {
          id: "A",
          name: "A",
          address: null,
          deliveryDate: null,
          isDemo: false,
          lat,
          lng,
          units: [],
        },
      ]).featured?.location;
    expect(dev(-23.55, -46.63)).toEqual({ lat: -23.55, lng: -46.63 });
    expect(dev(-23.55, null)).toBeNull();
  });

  it("monta o card de cada unidade com o WhatsApp da imobiliária", () => {
    const site = buildSite({ name: "H", creci: null, whatsapp: "5511900000000" }, [
      {
        id: "A",
        name: "Aurora",
        address: null,
        deliveryDate: null,
        isDemo: false,
        units: [unit({ code: "A-101", floor: 1, status: "available", price: 500000 })],
      },
    ]);
    const featured = site.featured;
    if (!featured) throw new Error("sem destaque");
    const [card] = cardsOf(featured);
    expect(card?.title).toBe("Unidade 101");
    expect(card?.price).toBe("R$ 500.000");
    expect(card?.action?.label).toBe("Quero essa");
  });
});
