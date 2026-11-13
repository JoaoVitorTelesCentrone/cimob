"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loadCurrentUnits } from "@/lib/import-queries";
import { codePrefix } from "@/lib/imports";
import { extractPdf } from "@/lib/ingest";
import { currentDecision } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/team";

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Manda o PDF ao leitor (services/ingest) e grava o rascunho. Nada muda no site até publicar.
 * O banco confere se quem pede é gestor da imobiliária do empreendimento.
 */
export async function importPdf(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const developmentId = z.uuid().safeParse(form.get("developmentId"));
  const file = form.get("file");
  if (!developmentId.success) return { ok: false, message: "Escolha o empreendimento." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Escolha o PDF." };
  if (file.size > MAX_BYTES) return { ok: false, message: "O PDF passa de 20 MB." };

  const decision = await currentDecision();
  if (decision.kind !== "enter") return { ok: false, message: "Escolha uma imobiliária" };

  // Código só com número no PDF ("502") ganha o prefixo das unidades do empreendimento ("AUR-").
  const typed = form.get("prefix");
  const prefix =
    typeof typed === "string" && typed.trim()
      ? typed.trim().toUpperCase()
      : codePrefix(
          (await loadCurrentUnits(decision.organization.id))
            .filter((u) => u.developmentId === developmentId.data)
            .map((u) => u.code),
        );

  const extracted = await extractPdf(file, prefix, {
    url: process.env.INGEST_URL ?? "",
    secret: process.env.INGEST_SECRET ?? "",
  });
  if (!extracted.ok) return { ok: false, message: extracted.message };
  if (extracted.rows.length === 0) {
    return { ok: false, message: "A tabela foi achada, mas sem nenhuma unidade com código." };
  }

  const supabase = await createClient();
  const result = await supabase.rpc("create_unit_import", {
    p_development: developmentId.data,
    p_file_name: file.name,
    p_rows: extracted.rows,
    p_warnings: extracted.warnings,
  });
  const id = z.uuid().safeParse(result.data);
  if (result.error || !id.success) return { ok: false, message: "Só o gestor importa tabelas." };
  redirect(`/app/imoveis/importar/${id.data}`);
}

export async function publishImport(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const id = z.uuid().safeParse(form.get("importId"));
  if (!id.success) return { ok: false, message: "Pedido inválido" };
  const supabase = await createClient();
  const result = await supabase.rpc("publish_unit_import", { p_import: id.data });
  if (result.error) {
    return result.error.code === "23505"
      ? { ok: false, message: "Há código que já é de outro empreendimento. Corrija antes de publicar." }
      : { ok: false, message: "Não foi possível publicar (já publicada, descartada ou sem permissão)." };
  }
  revalidatePath("/app/imoveis", "layout");
  return { ok: true, message: `Importação publicada: ${String(result.data)} unidades atualizadas ou criadas.` };
}

export async function discardImport(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const id = z.uuid().safeParse(form.get("importId"));
  if (!id.success) return { ok: false, message: "Pedido inválido" };
  const supabase = await createClient();
  const result = await supabase.rpc("discard_unit_import", { p_import: id.data });
  if (result.error) return { ok: false, message: "Não foi possível descartar." };
  revalidatePath("/app/imoveis", "layout");
  return { ok: true, message: "Importação descartada. Nada mudou nas unidades." };
}
