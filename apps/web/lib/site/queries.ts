import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { UNIT_STATUSES } from "@/lib/inventory";
import { supabaseEnv } from "@/lib/supabase/env";
import type { SiteBrand, SiteDevelopment } from "./model";

const num = z
  .union([z.string(), z.number()])
  .nullable()
  .transform((v) => (v === null ? null : Number(v)));

const DevelopmentRecord = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string().nullable(),
  delivery_date: z.string().nullable(),
  is_demo: z.boolean(),
  model_url: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  units: z.array(
    z.object({
      code: z.string(),
      floor: z.number().nullable(),
      position: z.string().nullable(),
      bedrooms: z.number().nullable(),
      parking: z.number().nullable(),
      mesh_name: z.string().nullable(),
      area_m2: num,
      price: num,
      status: z.enum(UNIT_STATUSES),
    }),
  ),
});

/** `organizations.brand`: só o que o site mostra. Valor fora do formato é ignorado (não inventa). */
const Brand = z.object({
  creci: z.string().trim().min(1).max(40).optional().catch(undefined),
  whatsapp: z
    .string()
    .regex(/^[1-9]\d{9,14}$/)
    .optional()
    .catch(undefined),
});

export function siteBrand(name: string, brand: Record<string, unknown>): SiteBrand {
  const b = Brand.parse(brand);
  return { name, creci: b.creci ?? null, whatsapp: b.whatsapp ?? null };
}

/**
 * Empreendimentos publicados da imobiliária, com as unidades. Chave publicável: o RLS só deixa o
 * visitante ver empreendimento publicado (e as unidades dele), nunca rascunho.
 */
export async function loadPublishedDevelopments(
  organizationId: string,
): Promise<SiteDevelopment[]> {
  const { url, key } = supabaseEnv();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("developments")
    .select(
      "id, name, address, delivery_date, is_demo, model_url, lat, lng, units(code, floor, position, bedrooms, parking, mesh_name, area_m2, price, status)",
    )
    .eq("organization_id", organizationId)
    .eq("published", true)
    .order("created_at");
  if (error) throw new Error(`empreendimentos: ${error.message}`);
  return z
    .array(DevelopmentRecord)
    .parse(data)
    .map((d) => ({
      id: d.id,
      name: d.name,
      address: d.address,
      deliveryDate: d.delivery_date,
      isDemo: d.is_demo,
      modelUrl: d.model_url,
      lat: d.lat,
      lng: d.lng,
      units: d.units.map((u) => ({
        code: u.code,
        floor: u.floor,
        position: u.position,
        bedrooms: u.bedrooms,
        parking: u.parking,
        meshName: u.mesh_name,
        areaM2: u.area_m2,
        price: u.price,
        status: u.status,
      })),
    }));
}
