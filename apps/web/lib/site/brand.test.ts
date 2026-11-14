import { describe, expect, it } from "vitest";
import { siteBrand } from "./queries";

describe("siteBrand", () => {
  it("lê CRECI, WhatsApp e logo do brand da imobiliária", () => {
    expect(
      siteBrand("Horizonte", {
        creci: " CRECI 1-J ",
        whatsapp: "5511900000000",
        logoUrl: "https://x.supabase.co/storage/v1/object/public/brand/org/logo.png?v=1",
      }),
    ).toEqual({
      name: "Horizonte",
      creci: "CRECI 1-J",
      whatsapp: "5511900000000",
      logoUrl: "https://x.supabase.co/storage/v1/object/public/brand/org/logo.png?v=1",
    });
  });

  it("valor fora do formato é ignorado, nunca mostrado", () => {
    expect(
      siteBrand("H", { creci: "", whatsapp: "(11) 9000-0000", logoUrl: "javascript:alert(1)" }),
    ).toEqual({
      name: "H",
      creci: null,
      whatsapp: null,
      logoUrl: null,
    });
    expect(siteBrand("H", {})).toEqual({ name: "H", creci: null, whatsapp: null, logoUrl: null });
  });
});
