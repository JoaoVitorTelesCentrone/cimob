import { describe, expect, it } from "vitest";
import type { UnitStatus } from "@/lib/inventory";
import { floorRows, previewSrc, previewSvg, UNIT_FILL } from "./facade";

type Unit = {
  code: string;
  floor: number | null;
  position: string | null;
  status: UnitStatus;
};

const unit = (
  code: string,
  floor: number | null,
  position: string | null,
  status: UnitStatus,
): Unit => ({ code, floor, position, status });

const AURORA: Unit[] = [
  unit("AUR-401", 4, "01", "sold"),
  unit("AUR-502", 5, "02", "available"),
  unit("AUR-501", 5, "01", "available"),
  unit("AUR-402", 4, "02", "reserved"),
];

describe("floorRows", () => {
  it("agrupa por andar de cima para baixo e ordena pela posição no andar", () => {
    const rows = floorRows(AURORA);
    expect(rows.map((r) => r.floor)).toEqual([5, 4]);
    expect(rows.map((r) => r.label)).toEqual(["5º andar", "4º andar"]);
    expect(rows[0]?.units.map((u) => u.code)).toEqual(["AUR-501", "AUR-502"]);
    expect(rows[1]?.units.map((u) => u.code)).toEqual(["AUR-401", "AUR-402"]);
  });

  it("unidade sem andar fica em Outras unidades, depois dos andares", () => {
    const rows = floorRows([...AURORA, unit("AUR-001", null, null, "available")]);
    expect(rows.map((r) => r.floor)).toEqual([5, 4, null]);
    expect(rows.at(-1)?.label).toBe("Outras unidades");
    expect(rows.at(-1)?.units.map((u) => u.code)).toEqual(["AUR-001"]);
  });

  it("térreo é um andar com nome próprio", () => {
    const rows = floorRows([unit("AUR-T01", 0, "01", "available")]);
    expect(rows[0]?.label).toBe("Térreo");
  });
});

describe("cores de status", () => {
  it("são fixas: vêm dos tokens de status, não da marca", () => {
    expect(UNIT_FILL).toEqual({
      available: "var(--available)",
      reserved: "var(--reserved)",
      sold: "var(--sold)",
    });
  });
});

describe("previewSvg", () => {
  it("desenha um retângulo por unidade com a cor do status", () => {
    const svg = previewSvg(AURORA);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.match(/<rect /g)).toHaveLength(4);
    expect(svg).toContain('fill="var(--available)"');
    expect(svg).toContain('fill="var(--reserved)"');
    expect(svg).toContain('fill="var(--sold)"');
    expect(svg).toContain(">5º<");
    expect(svg).toContain(">4º<");
  });

  it("vira uma data URI leve, sem requisição", () => {
    const src = previewSrc(AURORA);
    expect(src.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(src.split(",")[1] ?? "")).toBe(previewSvg(AURORA));
  });

  it("sem unidades, não desenha retângulos", () => {
    expect(previewSvg([]).match(/<rect /g)).toBeNull();
  });
});
