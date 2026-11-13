"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseStatusChange, planStatusChange, UNIT_STATUSES } from "@/lib/inventory";
import { loadMyRole } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { canManageTeam, type ActionResult } from "@/lib/team";

const TABLE = { unit: "units", property: "properties" } as const;

/** Muda o status de uma unidade ou imóvel. O RLS só deixa o gestor da própria imobiliária gravar. */
export async function changeStatus(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const input = parseStatusChange({
    kind: form.get("kind"),
    id: form.get("id"),
    expected: form.get("expected"),
    to: form.get("to"),
  });
  if (!input) return { ok: false, message: "Pedido inválido" };

  const decision = await currentDecision();
  if (decision.kind !== "enter") return { ok: false, message: "Escolha uma imobiliária" };
  const orgId = decision.organization.id;

  const supabase = await createClient();
  const table = TABLE[input.kind];
  const [found, role] = await Promise.all([
    supabase
      .from(table)
      .select("status")
      .eq("organization_id", orgId)
      .eq("id", input.id)
      .maybeSingle(),
    loadMyRole(orgId),
  ]);
  const current = z
    .object({ status: z.enum(UNIT_STATUSES) })
    .nullable()
    .safeParse(found.data);
  if (found.error || !current.success || !current.data) {
    return { ok: false, message: "Imóvel não encontrado" };
  }

  const plan = planStatusChange({
    canEdit: canManageTeam(role),
    current: current.data.status,
    expected: input.expected,
    to: input.to,
  });
  if (plan.kind === "noop") return { ok: true, message: "Nada mudou" };
  if (plan.kind === "error") return { ok: false, message: plan.message };

  // Só grava se o status ainda for o que a tela mostrava (evita sobrescrever a mudança de outra pessoa).
  const updated = await supabase
    .from(table)
    .update({ status: plan.to })
    .eq("organization_id", orgId)
    .eq("id", input.id)
    .eq("status", current.data.status)
    .select("id");
  if (updated.error) return { ok: false, message: "Não foi possível salvar. Tente de novo." };
  if (updated.data.length === 0) {
    return {
      ok: false,
      message: "Esta unidade foi alterada por outra pessoa. Atualize a página.",
    };
  }

  revalidatePath("/app/imoveis");
  return { ok: true, message: "Status salvo" };
}
