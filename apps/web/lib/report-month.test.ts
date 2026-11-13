import { describe, expect, it } from "vitest";
import { monthOptions, parseMonth } from "./report-month";

const now = new Date("2026-12-02T09:00:00-03:00");

describe("parseMonth", () => {
  it("usa o mês do endereço quando é válido e não está no futuro", () => {
    expect(parseMonth("2026-11", now)).toBe("2026-11");
    expect(parseMonth("2026-12", now)).toBe("2026-12");
  });

  it("sem mês, mês inválido ou futuro: o último mês fechado", () => {
    expect(parseMonth(undefined, now)).toBe("2026-11");
    expect(parseMonth("2026-13", now)).toBe("2026-11");
    expect(parseMonth("2027-01", now)).toBe("2026-11");
    expect(parseMonth(["2026-10"], now)).toBe("2026-10");
  });

  it("em janeiro, o último mês fechado é dezembro do ano anterior", () => {
    expect(parseMonth(undefined, new Date("2027-01-15T12:00:00-03:00"))).toBe("2026-12");
  });
});

describe("monthOptions", () => {
  it("os últimos 12 meses, do mais recente ao mais antigo, com o nome", () => {
    const options = monthOptions(now);
    expect(options).toHaveLength(12);
    expect(options[0]).toEqual({ value: "2026-12", label: "dezembro de 2026" });
    expect(options[11]?.value).toBe("2026-01");
  });
});
