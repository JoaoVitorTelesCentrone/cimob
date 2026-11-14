import { describe, expect, it } from "vitest";
import {
  businessMinutesBetween,
  businessMsBetween,
  isOpen,
  nextOpening,
  parseBusinessHours,
  type BusinessHours,
} from "./business-hours.ts";

/** Seg a sex, 9h às 18h (Brasília). */
const WEEK: BusinessHours = { days: [1, 2, 3, 4, 5], open: "09:00", close: "18:00" };
const br = (text: string) => new Date(`${text.replace(" ", "T")}:00-03:00`);

describe("parseBusinessHours", () => {
  it("aceita dias de 0 (domingo) a 6 e horário HH:MM com abertura antes do fechamento", () => {
    expect(parseBusinessHours({ days: [5, 1, 1, 3], open: "09:00", close: "18:00" })).toEqual({
      days: [1, 3, 5],
      open: "09:00",
      close: "18:00",
    });
  });

  it("sem configuração, ou inválida, é nulo (sem horário: tudo como antes)", () => {
    expect(parseBusinessHours(null)).toBeNull();
    expect(parseBusinessHours({ days: [], open: "09:00", close: "18:00" })).toBeNull();
    expect(parseBusinessHours({ days: [1], open: "18:00", close: "09:00" })).toBeNull();
    expect(parseBusinessHours({ days: [9], open: "09:00", close: "18:00" })).toBeNull();
  });
});

describe("isOpen e nextOpening", () => {
  it("dentro do horário está aberto; a próxima abertura é agora", () => {
    expect(isOpen(br("2026-11-13 10:00"), WEEK)).toBe(true); // sexta
    expect(nextOpening(br("2026-11-13 10:00"), WEEK)).toEqual(br("2026-11-13 10:00"));
  });

  it("sexta à noite abre na segunda às 9h", () => {
    expect(isOpen(br("2026-11-13 22:00"), WEEK)).toBe(false);
    expect(nextOpening(br("2026-11-13 22:00"), WEEK)).toEqual(br("2026-11-16 09:00"));
  });

  it("de madrugada abre no mesmo dia; o fechamento não está aberto", () => {
    expect(nextOpening(br("2026-11-11 06:30"), WEEK)).toEqual(br("2026-11-11 09:00"));
    expect(isOpen(br("2026-11-11 18:00"), WEEK)).toBe(false);
  });
});

describe("businessMinutesBetween", () => {
  it("conta só os minutos dentro do horário", () => {
    // Sexta 17:30 → segunda 10:00 = 30 min na sexta + 60 min na segunda.
    expect(businessMinutesBetween(br("2026-11-13 17:30"), br("2026-11-16 10:00"), WEEK)).toBe(90);
    // Mesmo dia útil: tempo corrido.
    expect(businessMinutesBetween(br("2026-11-11 10:00"), br("2026-11-11 12:15"), WEEK)).toBe(135);
    // Fim de semana inteiro: zero.
    expect(businessMinutesBetween(br("2026-11-14 08:00"), br("2026-11-15 20:00"), WEEK)).toBe(0);
  });

  it("sem horário configurado, conta o tempo corrido", () => {
    expect(businessMinutesBetween(br("2026-11-13 17:30"), br("2026-11-16 10:00"), null)).toBe(3870);
  });

  it("fim antes do início é zero", () => {
    expect(businessMinutesBetween(br("2026-11-13 12:00"), br("2026-11-13 11:00"), WEEK)).toBe(0);
  });
});

describe("businessMsBetween", () => {
  it("mede em milissegundos, sem arredondar (o limite de 2 h é exato)", () => {
    const from = br("2026-11-13 17:00");
    const to = new Date(br("2026-11-16 10:00").getTime() + 1);
    expect(businessMsBetween(from, to, WEEK)).toBe(2 * 60 * 60 * 1000 + 1);
    expect(businessMsBetween(from, to, null)).toBe(to.getTime() - from.getTime());
  });
});
