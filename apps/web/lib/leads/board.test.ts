import { describe, expect, it } from "vitest";
import { buildBoard, planMove, MAX_REASON } from "./board";
import type { LeadRow } from "./list";

const now = new Date("2026-11-12T15:00:00-03:00");
const lead = (over: Partial<LeadRow>): LeadRow => ({
  id: "1",
  name: "Ana",
  phone: "5511999990001",
  stage: "new",
  ownerId: "u1",
  ownerName: "Marina",
  assignedAt: null,
  firstResponseAt: null,
  createdAt: now,
  ...over,
});

describe("buildBoard", () => {
  it("tem uma coluna por estágio, mesmo vazia", () => {
    const board = buildBoard([], now);
    expect(board.map((c) => c.stage)).toEqual([
      "new",
      "qualified",
      "contacted",
      "visit_scheduled",
      "visit_done",
      "proposal",
      "won",
      "lost",
    ]);
    expect(board.every((c) => c.leads.length === 0)).toBe(true);
  });

  it("dentro da coluna: atrasados primeiro, depois os mais recentes", () => {
    const old = lead({ id: "old", createdAt: new Date(now.getTime() - 86_400_000) });
    const fresh = lead({ id: "fresh" });
    const late = lead({
      id: "late",
      assignedAt: new Date(now.getTime() - 3 * 3_600_000),
      createdAt: new Date(now.getTime() - 2 * 86_400_000),
    });
    const col = buildBoard([old, fresh, late], now)[0];
    expect(col?.leads.map((l) => l.id)).toEqual(["late", "fresh", "old"]);
  });
});

describe("planMove", () => {
  it("mesma etapa não faz nada", () => {
    expect(planMove({ current: "new", expected: "new", to: "new" })).toEqual({ kind: "noop" });
  });

  it("etapa inválida é recusada", () => {
    expect(planMove({ current: "new", expected: "new", to: "x" })).toEqual({
      kind: "error",
      message: "Etapa inválida",
    });
  });

  it("conflito quando o lead mudou desde que a tela foi aberta", () => {
    expect(planMove({ current: "contacted", expected: "new", to: "qualified" })).toMatchObject({
      kind: "error",
      message: "Este lead foi alterado por outra pessoa. Atualize a página.",
    });
  });

  it("estágio esperado inválido também é conflito", () => {
    expect(planMove({ current: "new", expected: "zzz", to: "qualified" })).toMatchObject({
      kind: "error",
    });
  });

  it("perdido exige motivo não vazio", () => {
    for (const reason of [undefined, "", "   "]) {
      expect(planMove({ current: "new", expected: "new", to: "lost", reason })).toEqual({
        kind: "error",
        message: "Informe o motivo da perda",
        needsReason: true,
      });
    }
  });

  it("perdido com motivo apara espaços e respeita o limite", () => {
    expect(planMove({ current: "new", expected: "new", to: "lost", reason: " ok " })).toEqual({
      kind: "move",
      to: "lost",
      lostReason: "ok",
    });
    expect(
      planMove({ current: "new", expected: "new", to: "lost", reason: "x".repeat(MAX_REASON) }),
    ).toMatchObject({ kind: "move" });
    expect(
      planMove({ current: "new", expected: "new", to: "lost", reason: "x".repeat(MAX_REASON + 1) }),
    ).toEqual({
      kind: "error",
      message: "O motivo pode ter no máximo 300 caracteres",
      needsReason: true,
    });
  });

  it("fora de perdido o motivo é ignorado", () => {
    expect(planMove({ current: "new", expected: "new", to: "won", reason: "x" })).toEqual({
      kind: "move",
      to: "won",
      lostReason: null,
    });
  });
});
