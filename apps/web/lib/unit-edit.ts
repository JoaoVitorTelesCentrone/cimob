/** Campos da unidade que o gestor edita pelo CRM. Nulo = sem informação (o bot não inventa). */
export type UnitPatch = {
  floor: number | null;
  areaM2: number | null;
  bedrooms: number | null;
  parking: number | null;
  price: number | null;
};
export type UnitEditPlan = { kind: "save"; patch: UnitPatch } | { kind: "error"; message: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** "R$ 780.000,00" / "780000" / "68,50" → número; vazio → null; ilegível → NaN. */
function decimal(raw: string): number | null {
  const t = raw.replace(/R\$|m²|\s/g, "");
  if (!t) return null;
  if (!/^[\d.,]+$/.test(t)) return Number.NaN;
  const normalized = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, "")
      : t;
  return Number(normalized);
}

function integer(raw: string): number | null {
  if (!raw) return null;
  return /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

/** Valida o formulário de edição da unidade (o RLS ainda confere no banco). */
export function planUnitEdit(input: { canEdit: boolean; raw: Record<string, unknown> }): UnitEditPlan {
  if (!input.canEdit) return { kind: "error", message: "Só o gestor edita a unidade" };
  const floorText = text(input.raw["floor"]);
  const floor = /^-?\d+$/.test(floorText) ? Number(floorText) : floorText ? Number.NaN : null;
  if (floor !== null && (Number.isNaN(floor) || floor < 0 || floor > 200)) {
    return { kind: "error", message: "Andar inválido" };
  }
  const areaM2 = decimal(text(input.raw["areaM2"]));
  if (areaM2 !== null && (Number.isNaN(areaM2) || areaM2 <= 0 || areaM2 > 100_000)) {
    return { kind: "error", message: "Área inválida" };
  }
  const bedrooms = integer(text(input.raw["bedrooms"]));
  if (bedrooms !== null && (Number.isNaN(bedrooms) || bedrooms > 50)) {
    return { kind: "error", message: "Quartos devem ser número inteiro" };
  }
  const parking = integer(text(input.raw["parking"]));
  if (parking !== null && (Number.isNaN(parking) || parking > 50)) {
    return { kind: "error", message: "Vagas devem ser número inteiro" };
  }
  const price = decimal(text(input.raw["price"]));
  if (price !== null && (Number.isNaN(price) || price <= 0)) {
    return { kind: "error", message: "Preço inválido" };
  }
  return { kind: "save", patch: { floor, areaM2, bedrooms, parking, price } };
}
