import { describe, expect, it } from "vitest";
import { createMediaDownloader } from "./media.ts";
import { createTranscriber } from "./transcribe-client.ts";

type Call = { url: string; init: RequestInit | undefined };

function fakeFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fetch, calls };
}
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const audio = new Uint8Array([1, 2, 3]);

describe("createTranscriber", () => {
  it("manda o áudio e devolve o texto e a duração", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { text: " oi ", duration_s: 12.4 }));
    const t = createTranscriber({ url: "http://transcribe:8000/", fetch });
    expect(await t(audio, "audio/ogg")).toEqual({ ok: true, text: "oi", durationS: 12.4 });
    expect(calls[0]?.url).toBe("http://transcribe:8000/transcribe");
    expect(new Headers(calls[0]?.init?.headers).get("content-type")).toBe("audio/ogg");
  });

  it("413 do serviço é áudio longo", async () => {
    const { fetch } = fakeFetch(() => json(413, { error: "too_long", duration_s: 180 }));
    expect(await createTranscriber({ url: "http://t", fetch })(audio, "audio/ogg")).toEqual({
      ok: false,
      reason: "too_long",
      durationS: 180,
    });
  });

  it("erro, texto vazio ou rede fora viram falha", async () => {
    for (const handler of [
      () => json(500, { error: "boom" }),
      () => json(200, { text: "  ", duration_s: 3 }),
      () => Promise.reject(new Error("ECONNREFUSED")),
    ]) {
      const { fetch } = fakeFetch(handler);
      const r = await createTranscriber({ url: "http://t", fetch })(audio, "audio/ogg");
      expect(r.ok).toBe(false);
      expect(r).toMatchObject({ reason: "failed" });
    }
  });

  it("estouro de tempo vira falha", async () => {
    const { fetch } = fakeFetch(
      (_url, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("abortado"));
          });
        }),
    );
    const r = await createTranscriber({ url: "http://t", fetch, timeoutMs: 20 })(audio, "a");
    expect(r).toMatchObject({ ok: false, reason: "failed" });
  });

  it("sem serviço configurado, falha na hora", async () => {
    expect(await createTranscriber({ url: null })(audio, "audio/ogg")).toEqual({
      ok: false,
      reason: "failed",
      error: "serviço de transcrição não configurado",
    });
  });
});

describe("createMediaDownloader", () => {
  it("pergunta a URL do arquivo à Graph API e baixa com o token", async () => {
    const { fetch, calls } = fakeFetch((url) =>
      url.endsWith("/MEDIA_1")
        ? json(200, { url: "https://lookaside.fbsbx.com/x", mime_type: "audio/ogg; codecs=opus" })
        : Promise.resolve(new Response(audio, { status: 200 })),
    );
    const download = createMediaDownloader({ version: "v26.0", fetch });
    const file = await download("MEDIA_1", "tok");
    expect(file.mimeType).toBe("audio/ogg; codecs=opus");
    expect([...file.bytes]).toEqual([1, 2, 3]);
    expect(calls.map((c) => c.url)).toEqual([
      "https://graph.facebook.com/v26.0/MEDIA_1",
      "https://lookaside.fbsbx.com/x",
    ]);
    for (const c of calls)
      expect(new Headers(c.init?.headers).get("authorization")).toBe("Bearer tok");
  });

  it("falha da Meta vira erro sem o token na mensagem", async () => {
    const { fetch } = fakeFetch(() =>
      json(404, { error: { message: "not found tok-secreto-longo" } }),
    );
    const download = createMediaDownloader({ version: "v26.0", fetch });
    await expect(download("M", "tok-secreto-longo")).rejects.toThrow(/HTTP 404/);
    await download("M", "tok-secreto-longo").catch((e: unknown) => {
      expect(String(e)).not.toContain("tok-secreto-longo");
    });
  });

  it("recusa arquivo grande demais", async () => {
    const big = new Uint8Array(17 * 1024 * 1024);
    const { fetch } = fakeFetch((url) =>
      url.endsWith("/M")
        ? json(200, { url: "https://f/x", mime_type: "audio/ogg" })
        : Promise.resolve(new Response(big)),
    );
    await expect(createMediaDownloader({ version: "v26.0", fetch })("M", "t")).rejects.toThrow(
      /grande/,
    );
  });
});
