import { describe, expect, it } from "vitest";
import { decideRoute, sanitizeHeaders, type Resolver } from "./route";

const tenant = { id: "org-1", slug: "horizonte" };
const found: Resolver = () => Promise.resolve(tenant);
const missing: Resolver = () => Promise.resolve(null);

describe("decideRoute", () => {
  it("reescreve o caminho para /<slug><caminho>", async () => {
    expect(await decideRoute({ host: "horizonte.localhost:3000", pathname: "/" }, found)).toEqual({
      kind: "rewrite",
      pathname: "/horizonte",
      organizationId: "org-1",
    });
    expect(
      await decideRoute({ host: "horizonte.localhost:3000", pathname: "/unidades/502" }, found),
    ).toMatchObject({ pathname: "/horizonte/unidades/502" });
  });

  it("usa a chave de domínio para domínio próprio", async () => {
    const keys: string[] = [];
    await decideRoute({ host: "www.x.com.br", pathname: "/" }, (k) => {
      keys.push(`${k.kind}:${k.value}`);
      return Promise.resolve(tenant);
    });
    expect(keys).toEqual(["domain:www.x.com.br"]);
  });

  it("404 quando a imobiliária não existe", async () => {
    expect(await decideRoute({ host: "a.localhost", pathname: "/" }, missing)).toEqual({
      kind: "notFound",
    });
  });

  it.each(["/app", "/app/leads", "/login", "/auth/callback", "/api/revalidate"])(
    "não reescreve %s no endereço de uma imobiliária",
    async (path) => {
      expect(await decideRoute({ host: "horizonte.localhost", pathname: path }, found)).toEqual({
        kind: "pass",
      });
    },
  );

  it("não trata /apple como /app", async () => {
    expect(
      await decideRoute({ host: "horizonte.localhost", pathname: "/apple" }, found),
    ).toMatchObject({
      kind: "rewrite",
    });
  });

  it("plataforma passa sem consultar", async () => {
    const never: Resolver = () => {
      throw new Error("não deveria consultar");
    };
    expect(await decideRoute({ host: "localhost:3000", pathname: "/" }, never)).toEqual({
      kind: "pass",
    });
  });
});

describe("sanitizeHeaders", () => {
  it("sempre remove o cabeçalho enviado pelo visitante", () => {
    const h = sanitizeHeaders(new Headers({ "x-organization-id": "forjado", accept: "x" }), null);
    expect(h.has("x-organization-id")).toBe(false);
    expect(h.get("accept")).toBe("x");
  });

  it("define o cabeçalho com a organização resolvida e não muta a entrada", () => {
    const input = new Headers({ "x-organization-id": "forjado" });
    const h = sanitizeHeaders(input, "org-1");
    expect(h.get("x-organization-id")).toBe("org-1");
    expect(input.get("x-organization-id")).toBe("forjado");
  });
});
