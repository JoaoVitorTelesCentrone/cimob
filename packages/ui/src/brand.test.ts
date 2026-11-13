import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "./color";
import { brandFromColor } from "./brand";

describe("brandFromColor", () => {
  it("mantém uma cor que já passa e normaliza para maiúsculas", () => {
    expect(brandFromColor("#155f4b").brand).toBe("#155F4B");
  });

  it("sempre usa branco como on-brand", () => {
    expect(brandFromColor("#D4145A").onBrand).toBe("#FFFFFF");
  });

  it.each(["#FFD700", "#90EE90", "#FFFF00", "#FFFFFF", "#00FFFF"])(
    "escurece %s até dar 4.5:1 com on-brand",
    (hex) => {
      const { brand, onBrand } = brandFromColor(hex);
      expect(contrastRatio(brand, onBrand)).toBeGreaterThanOrEqual(4.5);
      expect(relativeLuminance(brand)).toBeLessThan(relativeLuminance(hex));
    },
  );

  it("brand-strong é mais escuro e brand-soft mais claro que a marca", () => {
    const b = brandFromColor("#D4145A");
    expect(relativeLuminance(b.brandStrong)).toBeLessThan(relativeLuminance(b.brand));
    expect(relativeLuminance(b.brandSoft)).toBeGreaterThan(relativeLuminance(b.brand));
  });

  it("recusa cor inválida", () => {
    expect(() => brandFromColor("vermelho")).toThrow("Cor inválida");
  });
});
