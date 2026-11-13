import { describe, expect, it } from "vitest";
import {
  buildInventory,
  formatArea,
  formatPrice,
  formatUnit,
  parseStatusFilter,
  parseStatusChange,
  planStatusChange,
  STATUS_CLASS,
  STATUS_LABEL,
  summarize,
  type UnitRow,
} from "./inventory";

const unit = (over: Partial<UnitRow>): UnitRow => ({
  id: "u",
  developmentName: "Aurora",
  code: "AUR-101",
  floor: 1,
  areaM2: 58,
  bedrooms: 2,
  price: 520000,
  status: "available",
  ...over,
});

describe("formatação", () => {
  it("preço em reais sem centavos, com espaço comum", () => {
    expect(formatPrice(950000)).toBe("R$ 950.000");
    expect(formatPrice(null)).toBe("—");
  });

  it("área com vírgula só quando precisa", () => {
    expect(formatArea(82.5)).toBe("82,5 m²");
    expect(formatArea(64)).toBe("64 m²");
    expect(formatArea(null)).toBe("—");
  });

  it("andar ordinal e térreo", () => {
    expect(formatUnit(unit({ floor: 12 })).floor).toBe("12º");
    expect(formatUnit(unit({ floor: 0 })).floor).toBe("Térreo");
    expect(formatUnit(unit({ floor: null })).floor).toBe("—");
  });
});

describe("status", () => {
  it("rótulos em português", () => {
    expect(STATUS_LABEL).toEqual({
      available: "Disponível",
      reserved: "Reservado",
      sold: "Vendido",
    });
  });

  it("classes usam só os tokens fixos de status, nunca brand", () => {
    for (const cls of Object.values(STATUS_CLASS)) expect(cls).not.toMatch(/brand/);
    expect(STATUS_CLASS.reserved).toContain("reserved");
  });

  it("filtro inválido vira 'todos'", () => {
    expect(parseStatusFilter("sold")).toBe("sold");
    expect(parseStatusFilter("xyz")).toBeNull();
    expect(parseStatusFilter(undefined)).toBeNull();
  });
});

describe("summarize", () => {
  it("conta por status com plural", () => {
    expect(summarize([unit({}), unit({ status: "reserved" }), unit({ status: "reserved" })])).toBe(
      "1 disponível · 2 reservadas · 0 vendidas",
    );
  });
});

describe("buildInventory", () => {
  it("agrupa por empreendimento em ordem de nome e ordena por andar e código", () => {
    const inv = buildInventory(
      [
        unit({ developmentName: "Brisa", code: "BR-1" }),
        unit({ code: "AUR-502", floor: 5 }),
        unit({ code: "AUR-501", floor: 5 }),
        unit({ code: "AUR-T1", floor: null }),
      ],
      null,
    );
    expect(inv.map((g) => [g.development, g.units.map((u) => u.code)])).toEqual([
      ["Aurora", ["AUR-501", "AUR-502", "AUR-T1"]],
      ["Brisa", ["BR-1"]],
    ]);
  });

  it("o resumo conta todas as unidades, mesmo com filtro; empreendimento sem resultado some", () => {
    const inv = buildInventory(
      [
        unit({}),
        unit({ code: "AUR-2", status: "sold" }),
        unit({ developmentName: "Brisa", status: "sold" }),
      ],
      "available",
    );
    expect(inv).toHaveLength(1);
    expect(inv[0]?.summary).toBe("1 disponível · 0 reservadas · 1 vendida");
  });
});

describe("planStatusChange", () => {
  const base = { canEdit: true, current: "available", expected: "available" } as const;

  it("aceita outro status", () => {
    expect(planStatusChange({ ...base, to: "sold" })).toEqual({ kind: "change", to: "sold" });
  });

  it("a permissão vem antes de qualquer outra checagem", () => {
    expect(planStatusChange({ ...base, canEdit: false, to: "xyz" })).toEqual({
      kind: "error",
      message: "Só o gestor muda o status",
    });
  });
});

describe("parseStatusChange", () => {
  const id = "6f1c2a7e-3b9d-4c1e-9a55-0d2b7c4e8f10";

  it("aceita unidade ou imóvel com id válido", () => {
    expect(parseStatusChange({ kind: "unit", id, expected: "available", to: "sold" })).toEqual({
      kind: "unit",
      id,
      expected: "available",
      to: "sold",
    });
  });

  it("recusa tipo ou id inválidos", () => {
    expect(parseStatusChange({ kind: "lead", id, expected: "a", to: "b" })).toBeNull();
    expect(parseStatusChange({ kind: "unit", id: "x", expected: "a", to: "b" })).toBeNull();
  });
});
