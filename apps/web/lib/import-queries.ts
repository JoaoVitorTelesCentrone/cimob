import { connection } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUnit, ImportRow } from "./imports";
import { UNIT_STATUSES } from "./inventory";

/** Consultas da importação de PDF (T4.5). Client do usuário: o RLS mostra só ao gestor. */
async function sb() {
  await connection(); // o client do Supabase usa Date.now(): só na hora da requisição
  return createClient();
}

const num = z
  .union([z.string(), z.number()])
  .nullable()
  .transform((v) => (v === null ? null : Number(v)));

export async function loadDevelopments(organizationId: string) {
  const { data } = await (await sb())
    .from("developments")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name");
  const parsed = z.array(z.object({ id: z.uuid(), name: z.string() })).safeParse(data ?? []);
  return parsed.success ? parsed.data : [];
}

const UnitRecord = z.object({
  code: z.string(),
  development_id: z.uuid(),
  floor: z.number().nullable(),
  area_m2: num,
  bedrooms: z.number().nullable(),
  price: num,
  status: z.enum(UNIT_STATUSES),
});

/** Unidades da imobiliária, para comparar com o rascunho e sugerir o prefixo dos códigos. */
export async function loadCurrentUnits(organizationId: string): Promise<CurrentUnit[]> {
  const { data } = await (await sb())
    .from("units")
    .select("code, development_id, floor, area_m2, bedrooms, price, status")
    .eq("organization_id", organizationId)
    .limit(5000);
  const parsed = z.array(UnitRecord).safeParse(data ?? []);
  if (!parsed.success) return [];
  return parsed.data.map((u) => ({
    code: u.code,
    developmentId: u.development_id,
    floor: u.floor,
    areaM2: u.area_m2,
    bedrooms: u.bedrooms,
    price: u.price,
    status: u.status,
  }));
}

const ImportRecord = z.object({
  id: z.uuid(),
  development_id: z.uuid(),
  file_name: z.string(),
  status: z.enum(["draft", "published", "discarded"]),
  warnings: z.array(z.string()).catch([]),
  created_at: z.string(),
  developments: z.object({ name: z.string() }).nullable(),
});
const RowRecord = z.object({
  code: z.string(),
  floor: z.number().nullable(),
  area_m2: num,
  bedrooms: z.number().nullable(),
  parking: z.number().nullable(),
  price: num,
  status: z.enum(UNIT_STATUSES).nullable(),
  needs_review: z.boolean(),
  issues: z.array(z.string()).catch([]),
});

export type ImportSummary = {
  id: string;
  developmentId: string;
  developmentName: string;
  fileName: string;
  status: "draft" | "published" | "discarded";
  warnings: string[];
  createdAt: Date;
};

const toSummary = (i: z.infer<typeof ImportRecord>): ImportSummary => ({
  id: i.id,
  developmentId: i.development_id,
  developmentName: i.developments?.name ?? "—",
  fileName: i.file_name,
  status: i.status,
  warnings: i.warnings,
  createdAt: new Date(i.created_at),
});

export async function loadRecentImports(organizationId: string): Promise<ImportSummary[]> {
  const { data } = await (await sb())
    .from("unit_imports")
    .select("id, development_id, file_name, status, warnings, created_at, developments(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(10);
  const parsed = z.array(ImportRecord).safeParse(data ?? []);
  return parsed.success ? parsed.data.map(toSummary) : [];
}

export async function loadImport(
  id: string,
): Promise<{ summary: ImportSummary; rows: ImportRow[] } | null> {
  const client = await sb();
  const [imp, rows] = await Promise.all([
    client
      .from("unit_imports")
      .select("id, development_id, file_name, status, warnings, created_at, developments(name)")
      .eq("id", id)
      .maybeSingle(),
    client
      .from("unit_import_rows")
      .select("code, floor, area_m2, bedrooms, parking, price, status, needs_review, issues")
      .eq("import_id", id)
      .order("position"),
  ]);
  const summary = ImportRecord.safeParse(imp.data);
  const parsedRows = z.array(RowRecord).safeParse(rows.data ?? []);
  if (!summary.success || !parsedRows.success) return null;
  return {
    summary: toSummary(summary.data),
    rows: parsedRows.data.map((r) => ({
      code: r.code,
      floor: r.floor,
      areaM2: r.area_m2,
      bedrooms: r.bedrooms,
      parking: r.parking,
      price: r.price,
      status: r.status,
      needsReview: r.needs_review,
      issues: r.issues,
    })),
  };
}
