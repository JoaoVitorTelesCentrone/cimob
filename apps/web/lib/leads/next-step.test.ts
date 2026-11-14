import { describe, expect, it } from "vitest";
import { fromLocalInput, isNextStepOverdue, parseNextStep, parseVisit, toLocalInput } from "./next-step";

const now = new Date("2026-11-13T12:00:00-03:00");

describe("datas no fuso de Brasília", () => {
  it("o campo datetime-local é lido e mostrado em Brasília", () => {
    expect(fromLocalInput("2026-11-20T10:00")?.toISOString()).toBe("2026-11-20T13:00:00.000Z");
    expect(toLocalInput(new Date("2026-11-20T13:00:00Z"))).toBe("2026-11-20T10:00");
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("ontem")).toBeUndefined();
  });
});

describe("parseNextStep", () => {
  it("texto curto com data", () => {
    expect(parseNextStep({ text: "  Ligar amanhã ", at: "2026-11-14T10:00" })).toEqual({
      ok: true,
      text: "Ligar amanhã",
      at: new Date("2026-11-14T13:00:00Z"),
    });
  });

  it("texto vazio limpa o próximo passo", () => {
    expect(parseNextStep({ text: "", at: "2026-11-14T10:00" })).toEqual({ ok: true, text: null, at: null });
  });

  it("recusa texto longo e data ilegível", () => {
    expect(parseNextStep({ text: "x".repeat(201), at: "" })).toEqual({
      ok: false,
      message: "Use até 200 caracteres",
    });
    expect(parseNextStep({ text: "Ligar", at: "amanhã" })).toEqual({ ok: false, message: "Data inválida" });
  });
});

describe("parseVisit", () => {
  it("data da visita é obrigatória e legível", () => {
    expect(parseVisit("2026-11-22T15:00")).toEqual({ ok: true, at: new Date("2026-11-22T18:00:00Z") });
    expect(parseVisit("")).toEqual({ ok: false, message: "Escolha a data da visita" });
  });
});

describe("isNextStepOverdue", () => {
  it("vence quando a data passou; sem data ou sem passo, não", () => {
    expect(isNextStepOverdue({ nextStep: "Ligar", nextStepAt: new Date("2026-11-13T11:00:00-03:00") }, now)).toBe(true);
    expect(isNextStepOverdue({ nextStep: "Ligar", nextStepAt: new Date("2026-11-13T13:00:00-03:00") }, now)).toBe(false);
    expect(isNextStepOverdue({ nextStep: "Ligar", nextStepAt: null }, now)).toBe(false);
    expect(isNextStepOverdue({ nextStep: null, nextStepAt: new Date(0) }, now)).toBe(false);
  });
});
