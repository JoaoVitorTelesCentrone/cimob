import { describe, expect, it } from "vitest";
import { extractUnitCode } from "./unit-code.ts";

describe("extractUnitCode", () => {
  it("extrai o código no meio do texto", () => {
    expect(extractUnitCode("Oi, tenho interesse na AUR-502")).toBe("AUR-502");
  });

  it("aceita minúsculas e devolve em maiúsculas", () => {
    expect(extractUnitCode("quero saber da aur-502")).toBe("AUR-502");
  });
});

describe("extractUnitCode (sem código)", () => {
  it("devolve null quando não há código", () => {
    expect(extractUnitCode("Oi, tem apartamento disponível?")).toBeNull();
  });

  it("não reconhece trecho colado a outras letras ou números", () => {
    expect(extractUnitCode("XAUR-5021234567")).toBeNull();
  });
});
