/** Resultado da transcrição (serviço Python `services/transcribe`). */
export type TranscribeResult =
  | { ok: true; text: string; durationS: number }
  | { ok: false; reason: "too_long"; durationS: number }
  | { ok: false; reason: "failed"; error: string };

export type Transcriber = (audio: Uint8Array, mimeType: string) => Promise<TranscribeResult>;

/** Doc 04: transcrição com mais de 30 s vira falha (o bot pede para escrever). */
const TIMEOUT_MS = 30_000;

export function createTranscriber(opts: {
  url: string | null;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}): Transcriber {
  const doFetch = opts.fetch ?? globalThis.fetch;
  return async (audio, mimeType) => {
    if (!opts.url)
      return { ok: false, reason: "failed", error: "serviço de transcrição não configurado" };
    try {
      const res = await doFetch(`${opts.url.replace(/\/+$/, "")}/transcribe`, {
        method: "POST",
        headers: { "content-type": mimeType },
        body: audio,
        signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => null)) as {
        text?: string;
        duration_s?: number;
        error?: string;
      } | null;
      if (res.status === 413) {
        return { ok: false, reason: "too_long", durationS: body?.duration_s ?? 0 };
      }
      const text = body?.text?.trim();
      if (!res.ok || !text) {
        return { ok: false, reason: "failed", error: body?.error ?? `HTTP ${String(res.status)}` };
      }
      return { ok: true, text, durationS: body?.duration_s ?? 0 };
    } catch (e) {
      return { ok: false, reason: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  };
}
