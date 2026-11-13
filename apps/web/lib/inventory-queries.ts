import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { UNIT_STATUSES, type UnitRow, type UnitStatus } from "./inventory";

const MAX_ROWS = 2000;

const num = z
  .union([z.string(), z.number()])
  .nullable()
  .transform((v) => (v === null ? null : Number(v)));

const UnitRecord = z.object({
  id: z.uuid(),
  code: z.string(),
  floor: z.number().nullable(),
  area_m2: num,
  bedrooms: z.number().nullable(),
  price: num,
  status: z.enum(UNIT_STATUSES),
  developments: z.object({ name: z.string() }).nullable(),
});

const PropertyRecord = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
  neighborhood: z.string().nullable(),
  area_m2: num,
  bedrooms: z.number().nullable(),
  price: num,
  status: z.enum(UNIT_STATUSES),
});

export type PropertyRow = {
  id: string;
  code: string;
  title: string;
  neighborhood: string | null;
  areaM2: number | null;
  bedrooms: number | null;
  price: number | null;
  status: UnitStatus;
};

/** Unidades da organização com o nome do empreendimento (o RLS limita aos membros). */
export async function loadUnits(organizationId: string): Promise<UnitRow[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("units")
    .select("id, code, floor, area_m2, bedrooms, price, status, developments(name)")
    .eq("organization_id", organizationId)
    .limit(MAX_ROWS);
  if (error) throw new Error(error.message);
  return z
    .array(UnitRecord)
    .parse(data)
    .map((r) => ({
      id: r.id,
      developmentName: r.developments?.name ?? "Sem empreendimento",
      code: r.code,
      floor: r.floor,
      areaM2: r.area_m2,
      bedrooms: r.bedrooms,
      price: r.price,
      status: r.status,
    }));
}

/** Imóveis avulsos (usados, aluguel) da organização. */
export async function loadProperties(organizationId: string): Promise<PropertyRow[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("properties")
    .select("id, code, title, neighborhood, area_m2, bedrooms, price, status")
    .eq("organization_id", organizationId)
    .order("code")
    .limit(MAX_ROWS);
  if (error) throw new Error(error.message);
  return z
    .array(PropertyRecord)
    .parse(data)
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      neighborhood: r.neighborhood,
      areaM2: r.area_m2,
      bedrooms: r.bedrooms,
      price: r.price,
      status: r.status,
    }));
}
