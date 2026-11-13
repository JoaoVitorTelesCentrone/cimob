export type MediaFile = { bytes: Uint8Array; mimeType: string };
export type MediaDownloader = (mediaId: string, token: string) => Promise<MediaFile>;

/** Áudio de WhatsApp tem poucos KB por minuto; 16 MB é o limite da Cloud API para áudio. */
const MAX_BYTES = 16 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/**
 * Baixa uma mídia recebida: a Graph API devolve uma URL temporária, que também exige o token.
 * Erros nunca carregam o token.
 */
export function createMediaDownloader(opts: {
  version: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}): MediaDownloader {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const base = opts.baseUrl ?? "https://graph.facebook.com";
  return async (mediaId, token) => {
    const headers = { authorization: `Bearer ${token}` };
    const meta = await doFetch(`${base}/${opts.version}/${mediaId}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!meta.ok) throw new Error(`Meta: mídia ${mediaId} HTTP ${String(meta.status)}`);
    const info = (await meta.json()) as { url?: string; mime_type?: string };
    if (!info.url) throw new Error(`Meta: mídia ${mediaId} sem URL`);

    const file = await doFetch(info.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!file.ok) throw new Error(`Meta: download da mídia ${mediaId} HTTP ${String(file.status)}`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error(`Meta: mídia ${mediaId} grande demais`);
    return { bytes, mimeType: info.mime_type ?? "application/octet-stream" };
  };
}
