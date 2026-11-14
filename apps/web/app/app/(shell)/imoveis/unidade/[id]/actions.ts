"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadMyRole } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { canManageTeam, type ActionResult } from "@/lib/team";
import { planUnitEdit } from "@/lib/unit-edit";

/** Salva a ficha da unidade. O RLS (e o grant por coluna) só deixa o gestor gravar estes campos. */
export async function saveUnit(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(form.get("unitId"));
  if (!id.success) return { ok: false, message: "Pedido inválido" };
  const decision = await currentDecision();
  if (decision.kind !== "enter") return { ok: false, message: "Escolha uma imobiliária" };
  const orgId = decision.organization.id;

  const plan = planUnitEdit({ canEdit: canManageTeam(await loadMyRole(orgId)), raw: Object.fromEntries(form) });
  if (plan.kind === "error") return { ok: false, message: plan.message };

  const supabase = await createClient();
  const updated = await supabase
    .from("units")
    .update({
      floor: plan.patch.floor,
      area_m2: plan.patch.areaM2,
      bedrooms: plan.patch.bedrooms,
      parking: plan.patch.parking,
      price: plan.patch.price,
    })
    .eq("organization_id", orgId)
    .eq("id", id.data)
    .select("id");
  if (updated.error || updated.data.length === 0) return { ok: false, message: "Não foi possível salvar" };

  revalidatePath("/app/imoveis", "layout");
  return {
    ok: true,
    message: plan.patch.price === null ? "Salvo. Sem preço: o bot passa ao corretor." : "Unidade salva",
  };
}
