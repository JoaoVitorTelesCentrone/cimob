import { describe, expect, it } from "vitest";
import { applyList, isLate, parseListParams, type LeadRow } from "./list";

const now = new Date("2026-11-12T15:00:00-03:00");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

const lead = (over: Partial<LeadRow>): LeadRow => ({
  id: "1",
  name: "Ana",
  phone: "5511999990001",
  stage: "new",
  ownerId: "u1",
  ownerName: "Marina",
  assignedAt: hoursAgo(3),
  firstResponseAt: null,
  createdAt: hoursAgo(3),
  ...over,
});

describe("isLate", () => {
  it("atribuído há mais de 2 h sem resposta está atrasado", () => {
    expect(isLate(lead({}), now)).toBe(true);
  });

  it("exatamente 2 h ainda não está atrasado", () => {
    expect(isLate(lead({ assignedAt: hoursAgo(2) }), now)).toBe(false);
  });

  it("sem dono, respondido, ganho ou perdido não está atrasado", () => {
    expect(isLate(lead({ ownerId: null }), now)).toBe(false);
    expect(isLate(lead({ assignedAt: null }), now)).toBe(false);
    expect(isLate(lead({ firstResponseAt: hoursAgo(1) }), now)).toBe(false);
    expect(isLate(lead({ stage: "won" }), now)).toBe(false);
    expect(isLate(lead({ stage: "lost" }), now)).toBe(false);
  });
});

describe("isLate com horário de atendimento", () => {
  const WEEK = { days: [1, 2, 3, 4, 5], open: "09:00", close: "18:00" };
  const fridayNight = new Date("2026-11-13T22:00:00-03:00");

  it("conta só o tempo dentro do horário", () => {
    const l = lead({ assignedAt: fridayNight });
    expect(isLate(l, new Date("2026-11-16T11:00:00-03:00"), WEEK)).toBe(false);
    expect(isLate(l, new Date("2026-11-16T11:00:01-03:00"), WEEK)).toBe(true);
  });

  it("sem horário, tempo corrido", () => {
    expect(
      isLate(lead({ assignedAt: fridayNight }), new Date("2026-11-14T00:01:00-03:00"), null),
    ).toBe(true);
  });
});

describe("applyList com horário de atendimento", () => {
  it("o filtro e a ordem de atrasados seguem o horário", () => {
    const NO_THURSDAY = { days: [1, 2, 3, 5], open: "09:00", close: "18:00" };
    const leads = [lead({ id: "a", name: "Ana" })];
    expect(applyList(leads, { ...parseListParams({}), late: true }, now)).toHaveLength(1);
    expect(applyList(leads, { ...parseListParams({}), late: true }, now, NO_THURSDAY)).toHaveLength(
      0,
    );
  });
});

describe("parseListParams", () => {
  it("padrões quando nada vem no endereço", () => {
    expect(parseListParams({})).toEqual({
      q: "",
      stage: null,
      owner: null,
      late: false,
      sort: "recent",
    });
  });

  it("aceita valores válidos e usa o primeiro de listas", () => {
    expect(
      parseListParams({ q: [" ana ", "x"], stage: "won", owner: "u1", late: "1", sort: "name" }),
    ).toEqual({ q: "ana", stage: "won", owner: "u1", late: true, sort: "name" });
  });

  it("ignora valores inválidos", () => {
    expect(parseListParams({ stage: "xyz", sort: "hack", late: "talvez" })).toEqual(
      parseListParams({}),
    );
  });

  it("limita o tamanho da busca", () => {
    expect(parseListParams({ q: "a".repeat(500) }).q).toHaveLength(100);
  });
});

describe("applyList", () => {
  const base = parseListParams({});
  const ana = lead({ id: "a", name: "Ana", createdAt: hoursAgo(5) });
  const bia = lead({
    id: "b",
    name: "Bia",
    ownerId: null,
    assignedAt: null,
    createdAt: hoursAgo(1),
  });
  const caio = lead({
    id: "c",
    name: "Caio",
    firstResponseAt: hoursAgo(1),
    createdAt: hoursAgo(2),
  });

  it("atrasados primeiro, depois os mais recentes", () => {
    expect(applyList([caio, bia, ana], base, now).map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("ordenação por nome ignora acentos e mantém atrasados no topo", () => {
    const erica = lead({ id: "e", name: "Érica", firstResponseAt: hoursAgo(1) });
    const zeca = lead({ id: "z", name: "Zeca" });
    const list = applyList([zeca, erica, bia], { ...base, sort: "name" }, now);
    expect(list.map((l) => l.id)).toEqual(["z", "b", "e"]);
  });

  it("busca por nome sem acento e por dígitos do telefone", () => {
    const erica = lead({ id: "e", name: "Érica Nunes", phone: "5521988880003" });
    expect(applyList([ana, erica], { ...base, q: "ERICA" }, now).map((l) => l.id)).toEqual(["e"]);
    expect(applyList([ana, erica], { ...base, q: "(21) 98888" }, now).map((l) => l.id)).toEqual([
      "e",
    ]);
  });

  it("busca só com símbolos não filtra por telefone", () => {
    expect(applyList([ana, bia], { ...base, q: "()" }, now)).toHaveLength(0);
  });

  it("filtra por estágio, corretor e atrasados", () => {
    const won = lead({ id: "w", stage: "won", ownerId: "u2" });
    expect(applyList([ana, won], { ...base, stage: "won" }, now).map((l) => l.id)).toEqual(["w"]);
    expect(applyList([ana, won], { ...base, owner: "u2" }, now).map((l) => l.id)).toEqual(["w"]);
    expect(applyList([ana, caio], { ...base, late: true }, now).map((l) => l.id)).toEqual(["a"]);
  });

  it("não altera a lista recebida", () => {
    const input = [caio, ana];
    applyList(input, base, now);
    expect(input.map((l) => l.id)).toEqual(["c", "a"]);
  });
});
