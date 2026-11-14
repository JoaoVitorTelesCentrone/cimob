"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseNextStep, parseVisit } from "@/lib/leads/next-step";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/team";

/**
 * Exclusão LGPD: apaga lead, conversa, mensagens, histórico e consentimento, e deixa só o registro
 * anônimo. O banco (`delete_lead_data`) confere se quem pede é gestor da imobiliária do lead.
 */
export async function deleteLeadData(form: FormData): Promise<void> {
  const id = z.uuid().safeParse(form.get("leadId"));
  if (!id.success) redirect("/app/leads?lgpd=erro");

  const supabase = await createClient();
  const result = await supabase.rpc("delete_lead_data", { lead: id.data });
  if (result.error) redirect(`/app/leads/${id.data}?lgpd=erro`);

  revalidatePath("/app", "layout");
  redirect("/app/leads?lgpd=excluido");
}

const leadIdOf = (form: FormData) => z.uuid().safeParse(form.get("leadId"));
const field = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};
const DENIED = "Só o corretor do lead ou o gestor mexe nesta ficha";

/** 1ª resposta com a hora do servidor (o banco confere quem pode e registra no histórico). */
export async function recordFirstResponse(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const id = leadIdOf(form);
  if (!id.success) return { ok: false, message: "Pedido inválido" };
  const result = await (await createClient()).rpc("record_first_response", { p_lead: id.data });
  if (result.error) return { ok: false, message: DENIED };
  revalidatePath("/app", "layout");
  return { ok: true, message: "1ª resposta registrada" };
}

export async function saveNextStep(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const id = leadIdOf(form);
  if (!id.success) return { ok: false, message: "Pedido inválido" };
  const input = parseNextStep({ text: field(form, "text"), at: field(form, "at") });
  if (!input.ok) return { ok: false, message: input.message };
  const result = await (await createClient()).rpc("set_next_step", {
    p_lead: id.data,
    p_text: input.text,
    p_at: input.at?.toISOString() ?? null,
  });
  if (result.error) return { ok: false, message: DENIED };
  revalidatePath("/app/leads", "layout");
  return { ok: true, message: input.text ? "Próximo passo salvo" : "Próximo passo removido" };
}

export async function saveVisit(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const id = leadIdOf(form);
  if (!id.success) return { ok: false, message: "Pedido inválido" };
  const input = parseVisit(field(form, "at"));
  if (!input.ok) return { ok: false, message: input.message };
  const result = await (await createClient()).rpc("set_visit_at", { p_lead: id.data, p_at: input.at.toISOString() });
  if (result.error) return { ok: false, message: DENIED };
  revalidatePath("/app", "layout");
  return { ok: true, message: "Visita marcada" };
}
