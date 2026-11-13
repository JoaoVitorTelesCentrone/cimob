import { STATUS_COLORS, type UnitStatus } from "./layout";

export type ModelUnit = { code: string; meshName: string | null; status: UnitStatus };
export type ModelLink = { code: string; status: UnitStatus; color: string };

export type ModelMapping = {
  /** Objeto do GLB → unidade da ficha. Objeto fora do mapa (fachada, lajes) fica como veio. */
  byObject: Map<string, ModelLink>;
  /** Unidades sem objeto no modelo: aparecem só na lista. */
  outside: string[];
};

/** Liga os objetos do modelo do arquiteto às unidades pela coluna `mesh_name` (doc 05). */
export function mapModel(
  objectNames: readonly string[],
  units: readonly ModelUnit[],
): ModelMapping {
  const names = new Set(objectNames);
  const byObject = new Map<string, ModelLink>();
  const outside: string[] = [];
  for (const u of units) {
    if (u.meshName && names.has(u.meshName)) {
      byObject.set(u.meshName, { code: u.code, status: u.status, color: STATUS_COLORS[u.status] });
    } else {
      outside.push(u.code);
    }
  }
  return { byObject, outside };
}
