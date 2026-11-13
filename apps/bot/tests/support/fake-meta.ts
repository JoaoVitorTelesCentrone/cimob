import { randomUUID } from "node:crypto";
import type { CloudApi, CloudResult } from "../../src/outbound/cloud-api.ts";

export type SentCall = { phoneNumberId: string; token: string; payload: Record<string, unknown> };

/** Graph API falsa: registra o que recebe e responde conforme o roteiro do cenário. */
export class FakeMeta implements CloudApi {
  readonly calls: SentCall[] = [];
  private readonly script: CloudResult[] = [];
  private seq = 0;
  /** wa_message_id é único no banco inteiro: cada Meta falsa usa um prefixo próprio (testes rodam em paralelo). */
  private readonly prefix = randomUUID().slice(0, 8);

  /** As próximas respostas, uma por chamada; depois disso, sucesso. */
  respondNext(...results: CloudResult[]): void {
    this.script.push(...results);
  }

  send(
    phoneNumberId: string,
    token: string,
    payload: Record<string, unknown>,
  ): Promise<CloudResult> {
    this.calls.push({ phoneNumberId, token, payload });
    const scripted = this.script.shift();
    if (scripted) return Promise.resolve(scripted);
    this.seq += 1;
    return Promise.resolve({
      ok: true,
      waMessageId: `wamid.OUT-${this.prefix}-${String(this.seq)}`,
    });
  }
}

export const META_ERRORS = {
  "limite de envio": { ok: false, status: 429, code: 130429, message: "Rate limit hit" },
  "erro interno": { ok: false, status: 500, code: 131000, message: "Something went wrong" },
  "fora da janela de 24 horas": {
    ok: false,
    status: 400,
    code: 131047,
    message: "Re-engagement message",
  },
} as const satisfies Record<string, CloudResult>;
