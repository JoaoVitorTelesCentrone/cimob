import { describe, expect, it } from "vitest";
import { parseHost } from "./host";

describe("parseHost", () => {
  it("subdomínio da plataforma vira slug, sem porta e em minúsculas", () => {
    expect(parseHost("Horizonte.C1imob.com.br")).toEqual({ kind: "subdomain", slug: "horizonte" });
    expect(parseHost("horizonte.localhost:3000")).toEqual({ kind: "subdomain", slug: "horizonte" });
  });

  it("raiz, www e localhost são a plataforma", () => {
    for (const h of ["c1imob.com.br", "www.c1imob.com.br", "localhost:3000", "localhost"]) {
      expect(parseHost(h)).toEqual({ kind: "platform" });
    }
  });

  it("IP é a plataforma (desenvolvimento)", () => {
    expect(parseHost("127.0.0.1:3000")).toEqual({ kind: "platform" });
  });

  it("outro domínio é domínio próprio", () => {
    expect(parseHost("www.horizonteimoveis.com.br")).toEqual({
      kind: "custom",
      domain: "www.horizonteimoveis.com.br",
    });
  });

  it("não confunde sufixo parecido com subdomínio da plataforma", () => {
    expect(parseHost("fakec1imob.com.br")).toEqual({ kind: "custom", domain: "fakec1imob.com.br" });
  });

  it("aceita raízes customizadas", () => {
    expect(parseHost("a.exemplo.dev", ["exemplo.dev"])).toEqual({ kind: "subdomain", slug: "a" });
  });
});
