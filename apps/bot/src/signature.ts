import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "sha256=";
const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * Confere o `X-Hub-Signature-256` da Meta: HMAC-SHA256 do corpo bruto (bytes exatos) com o
 * segredo do app. Comparação em tempo constante para não vazar o valor esperado.
 */
export function isValidSignature(
  rawBody: string,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!appSecret || !header?.startsWith(PREFIX)) return false;
  const received = header.slice(PREFIX.length).toLowerCase();
  if (!HEX_64.test(received)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(received, "hex"));
}

/** Id da entrega: o mesmo corpo reenviado pela Meta vira o mesmo job (a fila descarta o repetido). */
export function payloadId(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
