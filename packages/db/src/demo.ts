import type postgres from "postgres";

/** Tudo aqui é DEMONSTRAÇÃO: toda linha criada leva is_demo = true (regra 6 do AGENTS.md). */
export const DEMO_SLUG = "demo-horizonte";

/** Vila Mariana, São Paulo (aproximado): o sol do espelho 3D é calculado por aqui. */
export const DEMO_LOCATION = { lat: -23.5891, lng: -46.6346 } as const;

export type DemoUnit = {
  code: string;
  floor: number;
  position: string;
  areaM2: number;
  bedrooms: number;
  parking: number;
  price: number;
  status: "available" | "reserved" | "sold";
  meshName: string;
};

const POSITIONS = [
  { position: "01", areaM2: 62, bedrooms: 2, parking: 1 },
  { position: "02", areaM2: 82, bedrooms: 3, parking: 2 },
  { position: "03", areaM2: 98, bedrooms: 3, parking: 2 },
  { position: "04", areaM2: 120, bedrooms: 4, parking: 3 },
];

export function demoUnits(): DemoUnit[] {
  const units: DemoUnit[] = [];
  for (let floor = 1; floor <= 10; floor++) {
    for (const p of POSITIONS) {
      const code = `AUR-${String(floor)}${p.position}`;
      const n = floor * 4 + Number(p.position);
      units.push({
        code,
        floor,
        ...p,
        // Preço fictício: 9.000 por m² mais 5.400 por andar (AUR-502 = R$ 765.000).
        price: p.areaM2 * 9000 + floor * 5400,
        status: n % 7 === 0 ? "sold" : n % 5 === 0 ? "reserved" : "available",
        meshName: code,
      });
    }
  }
  return units;
}

export type DemoLead = {
  name: string;
  phone: string;
  stage:
    | "new"
    | "qualified"
    | "contacted"
    | "visit_scheduled"
    | "visit_done"
    | "proposal"
    | "won"
    | "lost";
  source: string;
};

const STAGES: DemoLead["stage"][] = [
  "new",
  "new",
  "qualified",
  "contacted",
  "visit_scheduled",
  "visit_done",
  "proposal",
  "won",
  "lost",
  "new",
  "qualified",
  "contacted",
];

export function demoLeads(): DemoLead[] {
  return STAGES.map((stage, i) => ({
    name: `Lead demo ${String(i + 1).padStart(2, "0")}`,
    phone: `5511900000${String(i + 1).padStart(3, "0")}`,
    stage,
    source: i % 2 === 0 ? "meta_ads" : "site",
  }));
}

/** Cria a organização de demonstração com empreendimento, unidades e leads. Idempotente. */
export async function seedDemo(sql: postgres.Sql): Promise<void> {
  const [existing] = await sql<
    { id: string }[]
  >`select id from organizations where slug = ${DEMO_SLUG}`;
  if (existing) return;

  const [org] = await sql<{ id: string }[]>`
    insert into organizations (name, slug, brand, is_demo)
    values ('Horizonte Imóveis (demo)', ${DEMO_SLUG},
            ${sql.json({ color: "#155F4B", creci: "CRECI 00000-J (fictício)", whatsapp: "5511900000000" })},
            true)
    returning id`;
  const orgId = org?.id ?? "";

  const [dev] = await sql<{ id: string }[]>`
    insert into developments (organization_id, name, address, delivery_date, lat, lng, published, is_demo)
    values (${orgId}, 'Residencial Aurora', 'Vila Mariana, São Paulo', '2028-12-01',
            ${DEMO_LOCATION.lat}, ${DEMO_LOCATION.lng}, true, true)
    returning id`;
  const devId = dev?.id ?? "";

  for (const u of demoUnits()) {
    await sql`
      insert into units (organization_id, development_id, code, floor, position, area_m2, bedrooms, parking, price, status, mesh_name, is_demo)
      values (${orgId}, ${devId}, ${u.code}, ${u.floor}, ${u.position}, ${u.areaM2}, ${u.bedrooms}, ${u.parking}, ${u.price}, ${u.status}::unit_status, ${u.meshName}, true)`;
  }
  for (const l of demoLeads()) {
    await sql`
      insert into leads (organization_id, name, phone, stage, source, lost_reason, is_demo)
      values (${orgId}, ${l.name}, ${l.phone}, ${l.stage}::lead_stage, ${l.source}, ${l.stage === "lost" ? "Comprou com outra imobiliária (demo)" : null}, true)`;
  }
}

/** Remove só a demonstração (o cascade leva empreendimentos, unidades e leads). */
export async function removeDemo(sql: postgres.Sql): Promise<void> {
  await sql`delete from organizations where is_demo`;
}
