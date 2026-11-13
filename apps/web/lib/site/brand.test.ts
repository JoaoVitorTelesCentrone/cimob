import { describe, expect, it } from "vitest";
import { siteBrand } from "./queries";

describe("siteBrand", () => {
  it("lê CRECI e WhatsApp do brand da imobiliária", () => {
    expect(siteBrand("Horizonte", { creci: " CRECI 1-J ", whatsapp: "5511900000000" })).toEqual({
      name: "Horizonte",
      creci: "CRECI 1-J",
      whatsapp: "5511900000000",
    });
  });

  it("valor fora do formato é ignorado, nunca mostrado", () => {
    expect(siteBrand("H", { creci: "", whatsapp: "(11) 9000-0000" })).toEqual({
      name: "H",
      creci: null,
      whatsapp: null,
    });
    expect(siteBrand("H", {})).toEqual({ name: "H", creci: null, whatsapp: null });
  });
});
