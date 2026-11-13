import { describe, expect, it } from "vitest";
import { scrubEvent, scrubText } from "./scrub.ts";

describe("scrubText", () => {
  it("tira telefone, e-mail e tokens, mantendo o resto da frase", () => {
    expect(scrubText("lead 5511987654321 sem dono")).toBe("lead [telefone] sem dono");
    expect(scrubText("ligar para +55 (11) 98765-4321 hoje")).toBe("ligar para [telefone] hoje");
    expect(scrubText("convite para Ana.Souza@exemplo.com.br falhou")).toBe(
      "convite para [e-mail] falhou",
    );
    expect(scrubText("token EAAGabc123def456ghi789 inválido")).toBe("token [token] inválido");
    expect(scrubText("Authorization: Bearer abc.def-ghi")).toBe("Authorization: Bearer [token]");
    expect(scrubText("jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig")).toBe("jwt [token]");
    expect(scrubText("chave sb_secret_N1a2b3c4d5e6")).toBe("chave [token]");
  });

  it("não mexe em ids, datas e números curtos", () => {
    const text = "lead 3f2b8c1e-1d2a-4b3c-9d8e-0a1b2c3d4e5f em 2026-11-13, 3 tentativas, HTTP 500";
    expect(scrubText(text)).toBe(text);
  });
});

describe("scrubEvent", () => {
  it("tira corpo, cookies e cabeçalhos da requisição, e deixa só o id do usuário", () => {
    const event = scrubEvent({
      message: "falha com 5511987654321",
      request: {
        url: "https://c1imob.com.br/app/leads?q=5511987654321",
        method: "POST",
        data: { phone: "5511987654321" },
        cookies: { sb: "x" },
        headers: { authorization: "Bearer x", "user-agent": "Mozilla" },
        query_string: "q=5511987654321",
      },
      user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4" },
      extra: { body: "Olá" },
    });
    expect(event).toEqual({
      message: "falha com [telefone]",
      request: {
        url: "https://c1imob.com.br/app/leads?q=[telefone]",
        method: "POST",
        headers: { "user-agent": "Mozilla" },
        query_string: "q=[telefone]",
      },
      user: { id: "u1" },
    });
  });

  it("limpa as mensagens das exceções e dos breadcrumbs, sem os dados soltos deles", () => {
    const event = scrubEvent({
      exception: { values: [{ type: "Error", value: "lead a@b.com não achado" }] },
      breadcrumbs: [{ category: "fetch", message: "POST 5511987654321", data: { body: "x" } }],
    });
    expect(event).toEqual({
      exception: { values: [{ type: "Error", value: "lead [e-mail] não achado" }] },
      breadcrumbs: [{ category: "fetch", message: "POST [telefone]" }],
    });
  });
});
