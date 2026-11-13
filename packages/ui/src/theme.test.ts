import { describe, expect, it } from "vitest";
import { applyBrand, baseVars, brandCssVars } from "./theme";

describe("baseVars", () => {
  it("expõe os tokens do tema claro e do escuro", () => {
    expect(baseVars("light")["--available"]).toBe("#16A34A");
    expect(baseVars("dark")["--available"]).toBe("#4ADE80");
  });
});

describe("brandCssVars", () => {
  it("devolve só as quatro variáveis de marca", () => {
    expect(Object.keys(brandCssVars("#D4145A")).sort()).toEqual([
      "--brand",
      "--brand-soft",
      "--brand-strong",
      "--on-brand",
    ]);
  });

  it("recusa cor inválida", () => {
    expect(() => brandCssVars("x")).toThrow("Cor inválida");
  });
});

describe("applyBrand", () => {
  it("troca só as variáveis de marca", () => {
    const base = baseVars("light");
    const themed = applyBrand(base, "#D4145A");
    expect(themed["--brand"]).toBe("#D4145A");
    expect(themed["--reserved"]).toBe(base["--reserved"]);
    expect(themed["--surface"]).toBe(base["--surface"]);
  });
});
