import { lightVars } from "@c1imob/ui";

/**
 * Prédio procedural (doc 05): sem o GLB do arquiteto, cada unidade da ficha vira um bloco no
 * andar dela. Andar k fica em y = k × FLOOR_HEIGHT; o térreo é o saguão. Em cada andar, as
 * unidades (pela ordem de `position`) ficam numa grade de frente e fundos, sem se tocar.
 */

export type UnitStatus = "available" | "reserved" | "sold";

export type UnitInput = {
  code: string;
  floor: number | null;
  /** Posição no andar, como na ficha ("01", "02"...). */
  position: string | null;
  status: UnitStatus;
};

export type Vec3 = [number, number, number];

export type UnitBlock = {
  code: string;
  floor: number;
  status: UnitStatus;
  color: string;
  position: Vec3;
  size: Vec3;
};

export type BuildingLayout = {
  floors: number;
  floorHeight: number;
  blocks: UnitBlock[];
  /** Unidades sem andar válido na ficha: não entram no prédio (aparecem só na lista). */
  outside: string[];
  /** Altura do topo da cobertura. */
  roofY: number;
  footprint: { width: number; depth: number };
};

export const FLOOR_HEIGHT = 3;
const UNIT: Vec3 = [11.6, 2.55, 7.6];
const GAP = 0.4;
const MARGIN = 1;

/** Cores fixas de status (regra 7): vêm do design system e não mudam com a marca. */
export const STATUS_COLORS: Record<UnitStatus, string> = {
  available: lightVars["--available"] ?? "#16A34A",
  reserved: lightVars["--reserved"] ?? "#F59E0B",
  sold: lightVars["--sold"] ?? "#8B93A1",
};

const byPosition = (a: UnitInput, b: UnitInput) =>
  (a.position ?? "").localeCompare(b.position ?? "", "pt-BR", { numeric: true }) ||
  a.code.localeCompare(b.code, "pt-BR", { numeric: true });

export function layoutBuilding(units: readonly UnitInput[]): BuildingLayout {
  const placed = units.filter((u): u is UnitInput & { floor: number } => (u.floor ?? 0) >= 1);
  const outside = units.filter((u) => (u.floor ?? 0) < 1).map((u) => u.code);

  const byFloor = Map.groupBy(placed, (u) => u.floor);
  const perFloor = Math.max(0, ...[...byFloor.values()].map((list) => list.length));
  const rows = perFloor <= 1 ? 1 : 2;
  const cols = Math.max(1, Math.ceil(perFloor / rows));
  const stepX = UNIT[0] + GAP;
  const stepZ = UNIT[2] + GAP;

  const blocks: UnitBlock[] = [];
  for (const [floor, list] of [...byFloor].sort(([a], [b]) => a - b)) {
    [...list].sort(byPosition).forEach((u, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      blocks.push({
        code: u.code,
        floor,
        status: u.status,
        color: STATUS_COLORS[u.status],
        position: [
          (col - (cols - 1) / 2) * stepX,
          floor * FLOOR_HEIGHT + UNIT[1] / 2 + 0.2,
          ((rows - 1) / 2 - row) * stepZ,
        ],
        size: [...UNIT],
      });
    });
  }

  const floors = Math.max(0, ...placed.map((u) => u.floor));
  return {
    floors,
    floorHeight: FLOOR_HEIGHT,
    blocks,
    outside,
    roofY: (floors + 1) * FLOOR_HEIGHT + 0.5,
    footprint: { width: cols * stepX + MARGIN, depth: rows * stepZ + MARGIN },
  };
}
