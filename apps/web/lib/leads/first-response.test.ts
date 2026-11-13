import { describe, expect, it } from "vitest";
import { firstResponseMinutes, recordFirstResponse } from "./first-response";

const assignedAt = new Date("2026-11-12T12:00:00-03:00");
const lead = { assignedAt, firstResponseAt: null as Date | null };

describe("recordFirstResponse", () => {
  it("grava o horário da primeira resposta", () => {
    const at = new Date("2026-11-12T12:30:00-03:00");
    expect(recordFirstResponse(lead, at).firstResponseAt).toEqual(at);
  });

  it("não sobrescreve uma primeira resposta já registrada", () => {
    const first = new Date("2026-11-12T12:10:00-03:00");
    const later = new Date("2026-11-12T13:00:00-03:00");
    expect(recordFirstResponse({ ...lead, firstResponseAt: first }, later).firstResponseAt).toEqual(
      first,
    );
  });
});

describe("firstResponseMinutes", () => {
  it("mede os minutos entre a atribuição e a primeira resposta", () => {
    const firstResponseAt = new Date("2026-11-12T12:20:00-03:00");
    expect(firstResponseMinutes({ assignedAt, firstResponseAt })).toBe(20);
  });

  it("é nulo sem resposta ou sem atribuição", () => {
    expect(firstResponseMinutes(lead)).toBeNull();
    expect(firstResponseMinutes({ assignedAt: null, firstResponseAt: assignedAt })).toBeNull();
  });

  it("nunca é negativo (resposta registrada antes da atribuição conta como 0)", () => {
    const firstResponseAt = new Date("2026-11-12T11:00:00-03:00");
    expect(firstResponseMinutes({ assignedAt, firstResponseAt })).toBe(0);
  });
});
