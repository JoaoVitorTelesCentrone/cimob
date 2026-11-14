import { describe, expect, it } from "vitest";
import {
  brandForm,
  criteriaForm,
  parseAdsAccount,
  parseBrand,
  parseCustomDomain,
  parseBusinessHoursForm,
  businessHoursForm,
  parseCriteria,
  parseInvite,
  parseLogo,
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
  const ok = {
    name: "Lumen Imóveis",
    slug: "lumen",
    adminName: "Lia",
    adminEmail: "Lia@Lumen.com.br",
  };

  it("aceita e normaliza o e-mail", () => {
    expect(parseNewOrg(ok)).toEqual({
      ok: true,
      value: {
        name: "Lumen Imóveis",
        slug: "lumen",
        adminName: "Lia",
        adminEmail: "lia@lumen.com.br",
      },
    });
  });

  it("endereço vazio vem do nome", () => {
    expect(parseNewOrg({ ...ok, slug: "" })).toMatchObject({
      ok: true,
      value: { slug: "lumen-imoveis" },
    });
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
    expect(
      parseInvite({ name: " Rafael ", email: "R@X.com", whatsapp: "+55 (11) 97777-0001" }),
    ).toEqual({
      ok: true,
      value: { name: "Rafael", email: "r@x.com", whatsapp: "5511977770001" },
    });
    expect(parseInvite({ name: "Rafael", email: "r@x.com", whatsapp: "" })).toMatchObject({
      ok: true,
      value: { whatsapp: null },
    });
  });

  it("recusa WhatsApp sem DDI ou curto demais", () => {
    expect(parseInvite({ name: "R", email: "r@x.com", whatsapp: "123" })).toMatchObject({
      ok: false,
    });
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
    expect(parseBrand({ color: "azul", creci: "", whatsapp: "", privacyUrl: "" })).toMatchObject({
      ok: false,
    });
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

describe("parseLogo", () => {
  it("aceita PNG, JPEG e WebP até 1 MB, com a extensão certa", () => {
    expect(parseLogo({ type: "image/png", size: 50_000 })).toEqual({
      ok: true,
      value: { ext: "png", type: "image/png" },
    });
    expect(parseLogo({ type: "image/jpeg", size: 1_048_576 })).toEqual({
      ok: true,
      value: { ext: "jpg", type: "image/jpeg" },
    });
  });

  it("recusa SVG, arquivo vazio e acima de 1 MB", () => {
    expect(parseLogo({ type: "image/svg+xml", size: 100 })).toEqual({
      ok: false,
      message: "Use PNG, JPG ou WebP.",
    });
    expect(parseLogo({ type: "image/png", size: 0 })).toEqual({
      ok: false,
      message: "Escolha a imagem do logo.",
    });
    expect(parseLogo({ type: "image/png", size: 1_048_577 })).toEqual({
      ok: false,
      message: "O logo passa de 1 MB.",
    });
  });
});

describe("parseBusinessHoursForm e businessHoursForm", () => {
  it("dias marcados e janela válida viram o horário", () => {
    expect(
      parseBusinessHoursForm({ days: ["5", "1", "3"], open: "08:30", close: "17:00" }),
    ).toEqual({
      ok: true,
      value: { days: [1, 3, 5], open: "08:30", close: "17:00" },
    });
  });

  it("recusa sem dia, hora fora do formato ou fechamento antes da abertura", () => {
    expect(parseBusinessHoursForm({ days: [], open: "09:00", close: "18:00" })).toEqual({
      ok: false,
      message: "Escolha ao menos um dia.",
    });
    expect(parseBusinessHoursForm({ days: ["1"], open: "9h", close: "18:00" })).toEqual({
      ok: false,
      message: "Use o formato HH:MM.",
    });
    expect(parseBusinessHoursForm({ days: ["1"], open: "18:00", close: "18:00" })).toEqual({
      ok: false,
      message: "O fechamento precisa ser depois da abertura.",
    });
    expect(parseBusinessHoursForm({ days: ["7"], open: "09:00", close: "18:00" })).toEqual({
      ok: false,
      message: "Escolha ao menos um dia.",
    });
  });

  it("desligar o horário grava nulo (tempo corrido)", () => {
    expect(parseBusinessHoursForm({ enabled: "off", days: [], open: "", close: "" })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("o formulário começa com o horário salvo, ou seg–sex 9h–18h desligado", () => {
    expect(businessHoursForm({ days: [1, 2], open: "08:00", close: "12:00" })).toEqual({
      enabled: true,
      days: [1, 2],
      open: "08:00",
      close: "12:00",
    });
    expect(businessHoursForm(null)).toEqual({
      enabled: false,
      days: [1, 2, 3, 4, 5],
      open: "09:00",
      close: "18:00",
    });
  });
});

describe("parseCustomDomain", () => {
  it("minúsculas, sem espaço; vazio tira o domínio", () => {
    expect(parseCustomDomain(" WWW.Horizonte.com.br ")).toEqual({
      ok: true,
      value: "www.horizonte.com.br",
    });
    expect(parseCustomDomain("  ")).toEqual({ ok: true, value: "" });
  });

  it("aceita colado com https:// e barra no fim (tira os dois)", () => {
    expect(parseCustomDomain("https://horizonte.com.br/")).toEqual({
      ok: true,
      value: "horizonte.com.br",
    });
  });

  it("recusa formato inválido e domínio da plataforma", () => {
    for (const raw of [
      "horizonte",
      "horizonte imoveis.com.br",
      "a.c1imob.com.br",
      "c1imob.com.br",
      "localhost",
      "horizonte.com.br/site",
    ]) {
      expect(parseCustomDomain(raw)).toEqual({
        ok: false,
        message: "Use um domínio como imobiliaria.com.br (fora de c1imob.com.br).",
      });
    }
  });
});
