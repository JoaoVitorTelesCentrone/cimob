import { describe, expect, it } from "vitest";
import { codePrefix, reviewImport, type CurrentUnit, type ImportRow } from "./imports";

const DEV = "dev-aurora";
const row = (over: Partial<ImportRow>): ImportRow => ({
  code: "AUR-502",
  floor: null,
  areaM2: null,
  bedrooms: null,
  parking: null,
  price: null,
  status: null,
  needsReview: false,
  issues: [],
  ...over,
});
const current: CurrentUnit[] = [
  { code: "AUR-501", developmentId: DEV, floor: 5, areaM2: 68.5, bedrooms: 2, price: 700_000, status: "available" },
  { code: "AUR-502", developmentId: DEV, floor: 5, areaM2: 68.5, bedrooms: 2, price: 765_000, status: "available" },
  { code: "BOS-101", developmentId: "outro", floor: 1, areaM2: 50, bedrooms: 1, price: 400_000, status: "available" },
];

describe("reviewImport", () => {
  it("mostra o que muda em cada unidade existente, com os valores de antes e depois", () => {
    const r = reviewImport([row({ price: 780_000, status: "reserved", areaM2: 68.5 })], current, DEV);
    expect(r.rows[0]).toMatchObject({
      kind: "muda",
      changes: ["preço R$ 765.000 → R$ 780.000", "situação Disponível → Reservado"],
    });
  });

  it("linha igual à unidade é 'igual'; campo ilegível (nulo) não conta como mudança", () => {
    const r = reviewImport([row({ price: 765_000, status: null, needsReview: true, issues: ["situação ilegível"] })], current, DEV);
    expect(r.rows[0]).toMatchObject({ kind: "igual", changes: [] });
  });

  it("código novo é 'nova'; sem situação legível, avisa que entra como reservada", () => {
    const r = reviewImport(
      [row({ code: "AUR-503", price: 812_000, status: "available" }), row({ code: "AUR-801", price: 900_000 })],
      current,
      DEV,
    );
    expect(r.rows.map((x) => [x.kind, x.changes])).toEqual([
      ["nova", []],
      ["nova", ["entra como Reservado (situação ilegível)"]],
    ]);
  });

  it("código de outro empreendimento é conflito e impede publicar", () => {
    const r = reviewImport([row({ code: "BOS-101", price: 1 })], current, DEV);
    expect(r.rows[0]?.kind).toBe("conflito");
    expect(r.canPublish).toBe(false);
  });

  it("conta por tipo e quantas pedem revisão", () => {
    const r = reviewImport(
      [
        row({ price: 780_000 }),
        row({ code: "AUR-503", price: 1 }),
        row({ code: "AUR-704", needsReview: true, issues: ["preço ilegível"] }),
      ],
      current,
      DEV,
    );
    expect(r.counts).toEqual({ nova: 2, muda: 1, igual: 0, conflito: 0, revisar: 1 });
    expect(r.canPublish).toBe(true);
  });
});

describe("codePrefix", () => {
  it("usa o prefixo mais comum das unidades do empreendimento", () => {
    expect(codePrefix(["AUR-501", "AUR-502", "X1"])).toBe("AUR-");
  });

  it("sem padrão, vazio", () => {
    expect(codePrefix([])).toBe("");
    expect(codePrefix(["501", "502"])).toBe("");
  });
});
