import { describe, expect, it } from "vitest";
import { formatDateTime, formatPhone } from "./format";

describe("formatDateTime", () => {
  it("mostra no fuso de São Paulo", () => {
    expect(formatDateTime(new Date("2026-11-12T15:00:00Z"))).toBe("12/11/2026, 12:00");
  });

  it("traço quando não há data", () => {
    expect(formatDateTime(null)).toBe("—");
  });
});

describe("formatPhone", () => {
  it("formata celular brasileiro com DDI", () => {
    expect(formatPhone("5521988880003")).toBe("+55 (21) 98888-0003");
  });

  it("devolve como veio quando não reconhece", () => {
    expect(formatPhone("123")).toBe("123");
  });
});
