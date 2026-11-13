/** Resultado de um envio pela Cloud API. Nunca carrega o token. */
export type CloudResult =
  | { ok: true; waMessageId: string | null }
  | { ok: false; status: number; code: number | null; message: string };

export type CloudApi = {
  send(
    phoneNumberId: string,
    token: string,
    payload: Record<string, unknown>,
  ): Promise<CloudResult>;
};

const TIMEOUT_MS = 10_000;

/** Códigos de limite da Meta (throughput do número, par remetente-destinatário, spam). */
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056]);

export function classify(
  result: Extract<CloudResult, { ok: false }>,
): "rate_limited" | "retry" | "permanent" {
  if (result.status === 429 || (result.code !== null && RATE_LIMIT_CODES.has(result.code))) {
    return "rate_limited";
  }
  if (result.status === 0 || result.status >= 500) return "retry";
  return "permanent";
}

/** Tira o token de qualquer texto que possa ir para log ou banco (tokens reais são longos). */
const redact = (text: string, secret: string) =>
  secret.length >= 8 ? text.split(secret).join("***") : text;

/** Cliente da Graph API: POST /{versão}/{phone_number_id}/messages. */
export function createCloudApi(opts: {
  version: string;
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
}): CloudApi {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const base = opts.baseUrl ?? "https://graph.facebook.com";

  return {
    async send(phoneNumberId, token, payload) {
      let res: Response;
      try {
        res = await doFetch(`${base}/${opts.version}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, status: 0, code: null, message: redact(message, token) };
      }

      const body = (await res.json().catch(() => null)) as {
        messages?: { id?: string }[];
        error?: { code?: number; message?: string };
      } | null;
      if (res.ok) return { ok: true, waMessageId: body?.messages?.[0]?.id ?? null };
      return {
        ok: false,
        status: res.status,
        code: body?.error?.code ?? null,
        message: redact(body?.error?.message ?? `HTTP ${String(res.status)}`, token),
      };
    },
  };
}
