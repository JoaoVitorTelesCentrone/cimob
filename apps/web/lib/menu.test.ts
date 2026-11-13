import { describe, expect, it } from "vitest";
import { MENU, SECTIONS } from "./menu";

describe("menu do CRM", () => {
  it("tem as seis telas do doc 06 e o Painel primeiro", () => {
    expect(MENU.map((m) => m.href)).toEqual([
      "/app",
      "/app/funil",
      "/app/leads",
      "/app/imoveis",
      "/app/equipe",
      "/app/config",
    ]);
  });

  it("SECTIONS mapeia o segmento da rota para o rótulo", () => {
    expect(SECTIONS["leads"]).toBe("Leads");
    expect(SECTIONS["painel"]).toBeUndefined();
  });
});
