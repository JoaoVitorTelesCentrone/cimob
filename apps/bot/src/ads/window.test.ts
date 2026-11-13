import { describe, expect, it } from "vitest";
import { importWindow } from "./window.ts";

describe("importWindow", () => {
  it("cobre os últimos 7 dias até hoje, em datas de Brasília", () => {
    expect(importWindow(new Date("2026-11-12T15:00:00-03:00"))).toEqual({
      since: "2026-11-06",
      until: "2026-11-12",
    });
  });

  it("perto da meia-noite usa o dia de Brasília, não o de UTC", () => {
    // 23:30 de 12/11 em Brasília já é 13/11 em UTC.
    expect(importWindow(new Date("2026-11-12T23:30:00-03:00")).until).toBe("2026-11-12");
  });

  it("aceita outro tamanho de janela, atravessando o mês", () => {
    expect(importWindow(new Date("2026-11-02T10:00:00-03:00"), 3)).toEqual({
      since: "2026-10-31",
      until: "2026-11-02",
    });
  });
});
