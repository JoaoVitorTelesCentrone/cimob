import { describe, expect, it } from "vitest";
import { FLOOR_HEIGHT, layoutBuilding, STATUS_COLORS, type UnitInput } from "./layout";

const u = (code: string, floor: number | null, position: string | null = null): UnitInput => ({
  code,
  floor,
  position,
  status: "available",
});

describe("layoutBuilding", () => {
  it("prédio vazio não quebra", () => {
    expect(layoutBuilding([])).toMatchObject({ floors: 0, blocks: [], outside: [] });
  });

  it("ordena pela posição na ficha (01, 02, 10 em ordem numérica), não pela ordem recebida", () => {
    const b = layoutBuilding([u("A-110", 1, "10"), u("A-102", 1, "02"), u("A-101", 1, "01")]);
    const xs = b.blocks.map((x) => [x.code, x.position[0]] as const);
    const byX = [...xs].sort((p, q) => p[1] - q[1]).map((p) => p[0]);
    const front = b.blocks.filter(
      (x) => x.position[2] === Math.max(...b.blocks.map((y) => y.position[2])),
    );
    expect(front.map((x) => x.code).sort()).toEqual(["A-101", "A-102"]);
    expect(byX).toContain("A-110");
  });

  it("um andar com uma unidade fica centralizado", () => {
    const [block] = layoutBuilding([u("A-1", 1)]).blocks;
    expect(block?.position[0]).toBe(0);
    expect(block?.position[2]).toBe(0);
  });

  it("andar 0 ou negativo também fica fora do prédio (não há onde pôr)", () => {
    expect(layoutBuilding([u("T-1", 0), u("S-1", -1)]).outside).toEqual(["T-1", "S-1"]);
  });

  it("andares sem unidade entre dois andares ainda contam na altura", () => {
    const b = layoutBuilding([u("A-101", 1), u("A-501", 5)]);
    expect(b.floors).toBe(5);
    expect(b.roofY).toBeGreaterThan(5 * FLOOR_HEIGHT);
  });

  it("a base do prédio cobre todos os blocos", () => {
    const b = layoutBuilding(
      Array.from({ length: 6 }, (_, i) => u(`A-${String(i)}`, 1, String(i))),
    );
    for (const block of b.blocks) {
      expect(Math.abs(block.position[0]) + block.size[0] / 2).toBeLessThanOrEqual(
        b.footprint.width / 2,
      );
      expect(Math.abs(block.position[2]) + block.size[2] / 2).toBeLessThanOrEqual(
        b.footprint.depth / 2,
      );
    }
  });
});

describe("STATUS_COLORS", () => {
  it("vem dos tokens do design system", () => {
    expect(STATUS_COLORS).toEqual({ available: "#16A34A", reserved: "#F59E0B", sold: "#8B93A1" });
  });
});
