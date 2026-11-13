import type { UnitStatus } from "@/lib/inventory";
import { floorLabel, unitNumber } from "./unit-card";

/**
 * Grade 2D do espelho (fallback sem WebGL) e prévia estática do prédio (T3.5). Tudo é derivado
 * da ficha: andar, posição e status. Nada de número ou cor inventados (regras 2 e 7).
 */

export type FacadeUnit = {
  code: string;
  floor?: number | null;
  position?: string | null;
  status: UnitStatus;
};

export type FloorRow<T extends FacadeUnit = FacadeUnit> = {
  floor: number | null;
  label: string;
  units: T[];
};

/** Cores fixas de status (regra 7): os mesmos tokens do design system usados no 3D. */
export const UNIT_FILL: Record<UnitStatus, string> = {
  available: "var(--available)",
  reserved: "var(--reserved)",
  sold: "var(--sold)",
};

/** Texto legível sobre cada cor (o âmbar do reservado pede tinta escura). */
export const UNIT_TEXT: Record<UnitStatus, string> = {
  available: "text-white",
  reserved: "text-[#3B2A00]",
  sold: "text-white",
};

const byPosition = (a: FacadeUnit, b: FacadeUnit) =>
  (a.position ?? "").localeCompare(b.position ?? "", "pt-BR", { numeric: true }) ||
  a.code.localeCompare(b.code, "pt-BR", { numeric: true });

/**
 * Andares de cima para baixo, como no espelho impresso; dentro do andar, pela posição da ficha.
 * Unidade sem andar (ou térreo, que o 3D não monta) fica no fim, em "Outras unidades"/"Térreo".
 */
export function floorRows<T extends FacadeUnit>(units: readonly T[]): FloorRow<T>[] {
  const sorted = [...units].sort(
    (a, b) =>
      (b.floor ?? -Infinity) - (a.floor ?? -Infinity) ||
      byPosition(a, b),
  );
  const groups = new Map<number | null, T[]>();
  for (const unit of sorted) {
    const floor = unit.floor ?? null;
    const list = groups.get(floor);
    if (list) list.push(unit);
    else groups.set(floor, [unit]);
  }
  return [...groups].map(([floor, list]) => ({
    floor,
    label: floorLabel(floor) ?? "Outras unidades",
    units: list,
  }));
}

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 320;
const PAD = 8;
const GUTTER = 34;
const ROW_HEIGHT = 16;
const ROW_GAP = 4;
const CELL_WIDTH = 26;
const CELL_GAP = 3;

const shortFloor = (floor: number | null) =>
  floor === null ? "—" : floor === 0 ? "T" : `${String(floor)}º`;

/** Fachada estática em SVG: uma linha por andar e um retângulo por unidade na cor do status. */
export function previewSvg(units: readonly FacadeUnit[]): string {
  const rows = floorRows(units);
  const columns = Math.max(0, ...rows.map((r) => r.units.length));
  const width = Math.max(
    WIDTH,
    PAD + GUTTER + columns * CELL_WIDTH + Math.max(0, columns - 1) * CELL_GAP + PAD,
  );
  const height =
    rows.length === 0
      ? PAD * 2
      : PAD * 2 + rows.length * ROW_HEIGHT + (rows.length - 1) * ROW_GAP;
  const parts: string[] = [
    `<svg xmlns="${SVG_NS}" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">`,
  ];
  rows.forEach((row, index) => {
    const y = PAD + index * (ROW_HEIGHT + ROW_GAP);
    parts.push(
      `<text x="${String(PAD)}" y="${String(y + 12)}" font-family="system-ui, sans-serif" font-size="10" fill="var(--ink-muted)">${shortFloor(row.floor)}</text>`,
    );
    row.units.forEach((u, cell) => {
      const x = PAD + GUTTER + cell * (CELL_WIDTH + CELL_GAP);
      parts.push(
        `<rect x="${String(x)}" y="${String(y)}" width="${String(CELL_WIDTH)}" height="${String(ROW_HEIGHT)}" rx="2" fill="${UNIT_FILL[u.status]}"><title>${unitNumber(u.code)}</title></rect>`,
      );
    });
  });
  parts.push("</svg>");
  return parts.join("");
}

/** A prévia é uma data URI: nenhuma requisição, pintada junto com o HTML. */
export const previewSrc = (units: readonly FacadeUnit[]): string =>
  `data:image/svg+xml,${encodeURIComponent(previewSvg(units))}`;
