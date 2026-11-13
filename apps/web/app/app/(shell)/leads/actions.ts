"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
