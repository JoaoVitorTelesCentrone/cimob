import { describe, expect, it } from "vitest";
import {
  brandForm,
  criteriaForm,
  parseAdsAccount,
  parseBrand,
  parseCriteria,
  parseInvite,
  parseNewOrg,
  parsePhoneNumberId,
  slugify,
} from "./onboarding";

describe("slugify", () => {
  it("tira acento, espaço e símbolo, e corta em 40", () => {
    expect(slugify("Lumen Imóveis & Cia.")).toBe("lumen-imoveis-cia");
    expect(slugify("  --Horizonte--  ")).toBe("horizonte");
    expect(slugify("a".repeat(60))).toHaveLength(40);
  });
});

describe("parseNewOrg", () => {
  const ok = { name: "Lumen Imóveis", slug: "lumen", adminName: "Lia", adminEmail: "Lia@Lumen.com.br" };

  it("aceita e normaliza o e-mail", () => {
    expect(parseNewOrg(ok)).toEqual({
      ok: true,
      value: { name: "Lumen Imóveis", slug: "lumen", adminName: "Lia", adminEmail: "lia@lumen.com.br" },
    });
  });

  it("endereço vazio vem do nome", () => {
    expect(parseNewOrg({ ...ok, slug: "" })).toMatchObject({ ok: true, value: { slug: "lumen-imoveis" } });
  });

  it("recusa endereço reservado ou fora do formato, com mensagem", () => {
    expect(parseNewOrg({ ...ok, slug: "app" })).toEqual({
      ok: false,
      message: "Esse endereço é reservado. Escolha outro.",
    });
    expect(parseNewOrg({ ...ok, slug: "Com Espaço" })).toEqual({
      ok: false,
      message: "Use só letras minúsculas, números e hífen no endereço.",
    });
  });

  it("pede nome e e-mail válidos", () => {
    expect(parseNewOrg({ ...ok, name: " " })).toMatchObject({ ok: false });
    expect(parseNewOrg({ ...ok, adminEmail: "lia" })).toMatchObject({ ok: false });
    expect(parseNewOrg({ ...ok, adminName: "" })).toMatchObject({ ok: false });
  });
});

describe("parseInvite", () => {
  it("aceita nome, e-mail em minúsculas e WhatsApp opcional só com dígitos", () => {
    expect(parseInvite({ name: " Rafael ", email: "R@X.com", whatsapp: "+55 (11) 97777-0001" })).toEqual({
      ok: true,
      value: { name: "Rafael", email: "r@x.com", whatsapp: "5511977770001" },
    });
    expect(parseInvite({ name: "Rafael", email: "r@x.com", whatsapp: "" })).toMatchObject({
      ok: true,
      value: { whatsapp: null },
    });
  });

  it("recusa WhatsApp sem DDI ou curto demais", () => {
    expect(parseInvite({ name: "R", email: "r@x.com", whatsapp: "123" })).toMatchObject({ ok: false });
  });
});

describe("parseBrand e brandForm", () => {
  it("aceita cor, CRECI, WhatsApp e link https do aviso de privacidade", () => {
    expect(
      parseBrand({
        color: "#1d4ed8",
        creci: " CRECI 12345-J ",
        whatsapp: "5511900001111",
        privacyUrl: "https://lumen.com.br/privacidade",
      }),
    ).toEqual({
      ok: true,
      value: {
        color: "#1D4ED8",
        creci: "CRECI 12345-J",
        whatsapp: "5511900001111",
        privacyUrl: "https://lumen.com.br/privacidade",
      },
    });
  });

  it("campos vazios saem da marca (o site não mostra o que não existe)", () => {
    expect(parseBrand({ color: "#155F4B", creci: "", whatsapp: "", privacyUrl: "" })).toEqual({
      ok: true,
      value: { color: "#155F4B", creci: null, whatsapp: null, privacyUrl: null },
    });
  });

  it("recusa cor fora do formato e link que não é https", () => {
    expect(parseBrand({ color: "azul", creci: "", whatsapp: "", privacyUrl: "" })).toMatchObject({ ok: false });
    expect(
      parseBrand({ color: "#155F4B", creci: "", whatsapp: "", privacyUrl: "javascript:alert(1)" }),
    ).toMatchObject({ ok: false });
  });

  it("brandForm lê o que está no banco, ignorando valor estranho", () => {
    expect(brandForm({ color: "#155F4B", creci: 42, whatsapp: "5511900000000" })).toEqual({
      color: "#155F4B",
      creci: "",
      whatsapp: "5511900000000",
      privacyUrl: "",
    });
  });
});

describe("parseCriteria e criteriaForm", () => {
  it("aceita prazo 3m, 6m ou qualquer e porcentagem de 50 a 100", () => {
    expect(parseCriteria({ timeframe: "3m", priceShare: "100" })).toEqual({
      ok: true,
      value: { qualify_timeframe: "3m", qualify_price_share: 1 },
    });
    expect(parseCriteria({ timeframe: "any", priceShare: "75" })).toMatchObject({ ok: true });
  });

  it("recusa fora da faixa", () => {
    expect(parseCriteria({ timeframe: "12m", priceShare: "90" })).toMatchObject({ ok: false });
    expect(parseCriteria({ timeframe: "6m", priceShare: "40" })).toMatchObject({ ok: false });
  });

  it("criteriaForm mostra a porcentagem inteira", () => {
    expect(criteriaForm("6m", "0.90")).toEqual({ timeframe: "6m", priceShare: 90 });
  });
});

describe("parte técnica", () => {
  it("phone_number_id é obrigatório e só dígitos", () => {
    expect(parsePhoneNumberId(" 123456789012345 ")).toEqual({ ok: true, value: "123456789012345" });
    expect(parsePhoneNumberId("abc")).toMatchObject({ ok: false });
  });

  it("conta de anúncios aceita com ou sem act_", () => {
    expect(parseAdsAccount("act_777")).toEqual({ ok: true, value: "act_777" });
    expect(parseAdsAccount("777")).toEqual({ ok: true, value: "act_777" });
    expect(parseAdsAccount("act_x")).toMatchObject({ ok: false });
  });
});
