import { describe, expect, it } from "vitest";
import { classify, createCloudApi } from "./cloud-api.ts";

type Captured = { url: string; init: RequestInit };

function fakeFetch(response: () => Promise<Response>) {
  const seen: Captured[] = [];
  const fetch: typeof globalThis.fetch = (url, init) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    seen.push({ url: href, init: init ?? {} });
    return response();
  };
  return { fetch, seen };
}
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("createCloudApi", () => {
  it("POST na versão configurada, com o token no cabeçalho e o payload no corpo", async () => {
    const { fetch, seen } = fakeFetch(() => json(200, { messages: [{ id: "wamid.X" }] }));
    const api = createCloudApi({ version: "v26.0", fetch });
    const result = await api.send("PHONE_1", "tok", { to: "55", type: "text" });

    expect(result).toEqual({ ok: true, waMessageId: "wamid.X" });
    expect(seen[0]?.url).toBe("https://graph.facebook.com/v26.0/PHONE_1/messages");
    expect(seen[0]?.init.method).toBe("POST");
    expect(new Headers(seen[0]?.init.headers).get("authorization")).toBe("Bearer tok");
    const body = seen[0]?.init.body;
    expect(JSON.parse(typeof body === "string" ? body : "null")).toEqual({
      to: "55",
      type: "text",
    });
  });

  it("lê status, código e mensagem do erro da Meta", async () => {
    const { fetch } = fakeFetch(() =>
      json(400, { error: { code: 131047, message: "Re-engagement message" } }),
    );
    const result = await createCloudApi({ version: "v26.0", fetch }).send("P", "t", {});
    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 131047,
      message: "Re-engagement message",
    });
  });

  it("erro sem corpo JSON vira a mensagem HTTP", async () => {
    const { fetch } = fakeFetch(() =>
      Promise.resolve(new Response("bad gateway", { status: 502 })),
    );
    const result = await createCloudApi({ version: "v26.0", fetch }).send("P", "t", {});
    expect(result).toEqual({ ok: false, status: 502, code: null, message: "HTTP 502" });
  });

  it("falha de rede vira status 0 (tenta de novo)", async () => {
    const { fetch } = fakeFetch(() => Promise.reject(new Error("ECONNRESET")));
    const result = await createCloudApi({ version: "v26.0", fetch }).send("P", "t", {});
    expect(result).toEqual({ ok: false, status: 0, code: null, message: "ECONNRESET" });
  });

  it("200 sem id conta como enviada (não reenviar evita mensagem duplicada)", async () => {
    const { fetch } = fakeFetch(() => json(200, {}));
    expect(await createCloudApi({ version: "v26.0", fetch }).send("P", "t", {})).toEqual({
      ok: true,
      waMessageId: null,
    });
  });

  it("a mensagem de erro nunca carrega o token", async () => {
    const { fetch } = fakeFetch(() =>
      json(401, { error: { code: 190, message: "Invalid OAuth access token: tok-secreto" } }),
    );
    const result = await createCloudApi({ version: "v26.0", fetch }).send("P", "tok-secreto", {});
    expect(JSON.stringify(result)).not.toContain("tok-secreto");
  });
});

describe("classify", () => {
  const fail = (status: number, code: number | null) =>
    ({ ok: false, status, code, message: "x" }) as const;

  it("limite de envio da Meta (HTTP 429 ou códigos de limite)", () => {
    expect(classify(fail(429, null))).toBe("rate_limited");
    for (const code of [4, 80007, 130429, 131048, 131056]) {
      expect(classify(fail(400, code))).toBe("rate_limited");
    }
  });

  it("rede e erro do servidor da Meta: tenta de novo", () => {
    expect(classify(fail(0, null))).toBe("retry");
    expect(classify(fail(500, 131000))).toBe("retry");
    expect(classify(fail(503, null))).toBe("retry");
  });

  it("o resto é definitivo (janela de 24 h, número inválido, token inválido)", () => {
    expect(classify(fail(400, 131047))).toBe("permanent");
    expect(classify(fail(400, 131026))).toBe("permanent");
    expect(classify(fail(401, 190))).toBe("permanent");
  });
});
