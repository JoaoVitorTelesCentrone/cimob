"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { planMove } from "@/lib/leads/board";
import { STAGES } from "@/lib/leads/stages";
import { currentDecision } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export type MoveResult = { ok: true } | { ok: false; message: string; needsReason?: true };

const Input = z.object({
  leadId: z.uuid(),
  expected: z.string().max(40),
  to: z.string().max(40),
  reason: z.string().max(2000).optional(),
});

/** Move o lead de etapa com o client do usuário (o RLS vale). O evento é gravado por trigger no banco. */
export async function moveLead(raw: unknown): Promise<MoveResult> {
  const input = Input.safeParse(raw);
  if (!input.success) return { ok: false, message: "Pedido inválido" };

  const decision = await currentDecision();
  if (decision.kind !== "enter") return { ok: false, message: "Escolha uma imobiliária" };
  const orgId = decision.organization.id;

  const supabase = await createClient();
  const found = await supabase
    .from("leads")
    .select("stage")
    .eq("organization_id", orgId)
    .eq("id", input.data.leadId)
    .maybeSingle();
  const current = z
    .object({ stage: z.enum(STAGES) })
    .nullable()
    .safeParse(found.data);
  if (found.error || !current.success || !current.data) {
    return { ok: false, message: "Lead não encontrado" };
  }

  const plan = planMove({ current: current.data.stage, ...input.data });
  if (plan.kind === "noop") return { ok: true };
  if (plan.kind === "error") {
    return plan.needsReason
      ? { ok: false, message: plan.message, needsReason: true }
      : { ok: false, message: plan.message };
  }

  // Só grava se o estágio ainda for o que lemos (evita sobrescrever a mudança de outra pessoa).
  const updated = await supabase
    .from("leads")
    .update({ stage: plan.to, lost_reason: plan.lostReason })
    .eq("organization_id", orgId)
    .eq("id", input.data.leadId)
    .eq("stage", current.data.stage)
    .select("id");
  if (updated.error) return { ok: false, message: "Não foi possível salvar. Tente de novo." };
  if (updated.data.length === 0) {
    return { ok: false, message: "Este lead foi alterado por outra pessoa. Atualize a página." };
  }

  revalidatePath("/app/funil");
  revalidatePath("/app/leads");
  return { ok: true };
}
