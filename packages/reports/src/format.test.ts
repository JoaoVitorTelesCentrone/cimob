import { describe, expect, it } from "vitest";
import { formatDelta, formatValue, monthRange } from "./format.ts";

describe("monthRange", () => {
  it("começa e termina na meia-noite de Brasília, com o mês anterior e o nome", () => {
    const r = monthRange("2026-11");
    expect(r.start.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(r.previous).toBe("2026-10");
    expect(r.label).toBe("novembro de 2026");
  });

  it("janeiro volta para dezembro do ano anterior", () => {
    expect(monthRange("2027-01").previous).toBe("2026-12");
  });

  it("recusa mês fora do formato", () => {
    expect(() => monthRange("2026-13")).toThrow();
    expect(() => monthRange("nov")).toThrow();
  });
});

describe("formatValue", () => {
  it("contagem, dinheiro e minutos; vazio é traço", () => {
    expect(formatValue(4, "count")).toBe("4");
    expect(formatValue(1234.5, "money")).toBe("1.234,50");
    expect(formatValue(114.6, "minutes")).toBe("115 min");
    expect(formatValue(null, "money")).toBe("–");
  });
});

describe("formatDelta", () => {
  it("diferença e porcentagem contra o mês anterior", () => {
    expect(formatDelta(4, 2, "count")).toBe("+2 (+100%)");
    expect(formatDelta(1, 4, "count")).toBe("-3 (-75%)");
    expect(formatDelta(600, 200, "money")).toBe("+400,00 (+200%)");
    expect(formatDelta(3, 3, "count")).toBe("igual");
  });

  it("sem base de comparação não inventa porcentagem", () => {
    expect(formatDelta(1, 0, "count")).toBe("+1");
    expect(formatDelta(1, null, "count")).toBe("–");
    expect(formatDelta(null, 3, "count")).toBe("–");
  });
});
