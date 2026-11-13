import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "./color";

describe("contrastRatio", () => {
  it("preto sobre branco é 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });
});

describe("contrastRatio (simetria e limites)", () => {
  it("cores iguais dão 1", () => {
    expect(contrastRatio("#155F4B", "#155F4B")).toBeCloseTo(1, 5);
  });

  it("não depende da ordem", () => {
    expect(contrastRatio("#155F4B", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#155F4B"), 5);
  });

  it("verde Center One com branco passa de 4.5", () => {
    expect(contrastRatio("#155F4B", "#FFFFFF")).toBeGreaterThan(4.5);
  });
});

describe("relativeLuminance", () => {
  it("preto é 0 e branco é 1", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("recusa hex inválido", () => {
    expect(() => relativeLuminance("vermelho")).toThrow("Cor inválida");
    expect(() => relativeLuminance("#FFF")).toThrow("Cor inválida");
  });
});
