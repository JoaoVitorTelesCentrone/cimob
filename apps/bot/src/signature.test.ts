import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidSignature, payloadId } from "./signature.ts";

const secret = "segredo-app";
const body = '{"object":"whatsapp_business_account"}';
const sign = (b: string, key = secret) =>
  `sha256=${createHmac("sha256", key).update(b).digest("hex")}`;

describe("isValidSignature", () => {
  it("aceita o HMAC-SHA256 do corpo bruto com o segredo do app", () => {
    expect(isValidSignature(body, sign(body), secret)).toBe(true);
  });

  it("recusa assinatura de outro segredo ou de outro corpo", () => {
    expect(isValidSignature(body, sign(body, "outro"), secret)).toBe(false);
    expect(isValidSignature(`${body} `, sign(body), secret)).toBe(false);
  });

  it("recusa cabeçalho ausente, sem prefixo ou com tamanho errado", () => {
    expect(isValidSignature(body, undefined, secret)).toBe(false);
    expect(isValidSignature(body, sign(body).replace("sha256=", ""), secret)).toBe(false);
    expect(isValidSignature(body, "sha256=abc", secret)).toBe(false);
    expect(isValidSignature(body, `sha256=${"z".repeat(64)}`, secret)).toBe(false);
  });

  it("aceita o hexadecimal em maiúsculas", () => {
    expect(
      isValidSignature(body, sign(body).toUpperCase().replace("SHA256=", "sha256="), secret),
    ).toBe(true);
  });

  it("sem segredo configurado nada passa", () => {
    expect(isValidSignature(body, sign(body, ""), "")).toBe(false);
  });

  it("usa os bytes do corpo (acentos e emoji contam como UTF-8)", () => {
    const text = '{"text":"Olá 👋"}';
    expect(isValidSignature(text, sign(text), secret)).toBe(true);
  });
});

describe("payloadId", () => {
  it("é estável para o mesmo corpo e muda com qualquer byte", () => {
    expect(payloadId(body)).toBe(payloadId(body));
    expect(payloadId(body)).not.toBe(payloadId(`${body} `));
    expect(payloadId(body)).toMatch(/^[0-9a-f]{64}$/);
  });
});
