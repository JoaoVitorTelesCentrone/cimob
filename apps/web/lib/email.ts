import { z } from "zod";

export type EmailResult = { ok: true; email: string } | { ok: false; message: string };

const MESSAGE = "Informe um e-mail válido";
const schema = z.string().trim().toLowerCase().pipe(z.email());

export function parseEmail(input: string): EmailResult {
  const parsed = schema.safeParse(input);
  return parsed.success ? { ok: true, email: parsed.data } : { ok: false, message: MESSAGE };
}
