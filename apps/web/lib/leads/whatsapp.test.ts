import { describe, expect, it } from "vitest";
import { whatsappUrl } from "./whatsapp";

describe("whatsappUrl", () => {
  it("usa só os dígitos do telefone", () => {
    expect(whatsappUrl("+55 (21) 98888-0003")).toBe("https://wa.me/5521988880003");
  });

  it("acrescenta o texto codificado quando houver", () => {
    expect(whatsappUrl("5511999990001", "Olá, Ana & cia")).toBe(
      "https://wa.me/5511999990001?text=Ol%C3%A1%2C%20Ana%20%26%20cia",
    );
  });
});
