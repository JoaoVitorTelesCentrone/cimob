"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { parseInvite } from "@/lib/onboarding";
import { sendAccessLink } from "@/lib/supabase/access-link";
import { loadMembers } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { assignMessage, parseRotationToggle, parseWhatsapp, type ActionResult } from "@/lib/team";

/** Liga ou desliga o rodízio de um membro. O RLS só deixa o gestor mudar (e só a coluna in_rotation). */
export async function setRotation(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const input = parseRotationToggle({
    userId: form.get("userId"),
    inRotation: form.get("inRotation"),
  });
  if (!input) return { ok: false, message: "Pedido inválido" };

  const decision = await currentDecision();
  if (decision.kind !== "enter") return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const updated = await supabase
    .from("memberships")
    .update({ in_rotation: input.inRotation })
    .eq("organization_id", decision.organization.id)
    .eq("user_id", input.userId)
    .select("user_id");
  if (updated.error) return { ok: false, message: "Não foi possível salvar. Tente de novo." };
  if (updated.data.length === 0) {
    return { ok: false, message: "Só o gestor pode mudar o rodízio" };
  }

  revalidatePath("/app/equipe");
  return { ok: true, message: input.inRotation ? "Entrou no rodízio" : "Saiu do rodízio" };
}

/** Distribui um lead sem dono pelo rodízio. O banco confere se quem pede é gestor da organização do lead. */
export async function assignByRotation(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const leadId = z.uuid().safeParse(form.get("leadId"));
  if (!leadId.success) return { ok: false, message: "Pedido inválido" };

  const decision = await currentDecision();
  if (decision.kind !== "enter") return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const result = await supabase.rpc("assign_lead_by_rotation", { lead: leadId.data });
  const owner = z.uuid().nullable().safeParse(result.data);
  if (result.error || !owner.success) {
    return { ok: false, message: "Só o gestor pode distribuir leads" };
  }

  const members = await loadMembers(decision.organization.id);
  revalidatePath("/app/leads");
  revalidatePath("/app/funil");
  revalidatePath("/app/equipe");
  revalidatePath("/app");
  return assignMessage(owner.data, members);
}

/** Salva o WhatsApp de um membro (recebe o resumo dos leads). O RLS só deixa o gestor gravar. */
export async function setWhatsapp(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const userId = z.uuid().safeParse(form.get("userId"));
  const raw = form.get("whatsapp");
  if (!userId.success || typeof raw !== "string") return { ok: false, message: "Pedido inválido" };
  const parsed = parseWhatsapp(raw);
  if (!parsed.ok) return parsed;

  const decision = await currentDecision();
  if (decision.kind !== "enter") return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const updated = await supabase
    .from("memberships")
    .update({ whatsapp: parsed.whatsapp })
    .eq("organization_id", decision.organization.id)
    .eq("user_id", userId.data)
    .select("user_id");
  if (updated.error) {
    return updated.error.code === "23505"
      ? { ok: false, message: "Este número já está com outra pessoa da equipe" }
      : { ok: false, message: "Não foi possível salvar. Tente de novo." };
  }
  if (updated.data.length === 0) return { ok: false, message: "Só o gestor muda o WhatsApp" };

  revalidatePath("/app/equipe");
  return { ok: true, message: parsed.whatsapp ? "WhatsApp salvo" : "WhatsApp removido" };
}

/** Convida alguém para a equipe e manda o link de acesso. O banco confere se quem pede é gestor. */
export async function inviteMember(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const input = parseInvite(Object.fromEntries(form));
  if (!input.ok) return { ok: false, message: input.message };
  const role = form.get("role") === "org_admin" ? "org_admin" : "agent";

  const decision = await currentDecision();
  if (decision.kind !== "enter") return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const result = await supabase.rpc("invite_member", {
    p_org: decision.organization.id,
    p_email: input.value.email,
    p_role: role,
    p_name: input.value.name,
    p_whatsapp: input.value.whatsapp,
  });
  if (result.error) {
    return result.error.code === "23505"
      ? { ok: false, message: `${input.value.email} já faz parte da equipe` }
      : { ok: false, message: "Só o gestor convida pessoas para a equipe" };
  }

  const sent = await sendAccessLink(input.value.email, (await headers()).get("origin") ?? "");
  revalidatePath("/app/equipe");
  return {
    ok: true,
    message: sent
      ? `Convite enviado para ${input.value.email}`
      : `Convite criado. Peça a ${input.value.name} para entrar pelo login com ${input.value.email}.`,
  };
}

/** Desativa (perde o acesso e sai do rodízio) ou reativa alguém da equipe. */
export async function setMemberActive(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const userId = z.uuid().safeParse(form.get("userId"));
  if (!userId.success) return { ok: false, message: "Pedido inválido" };
  const active = form.get("active") === "true";

  const decision = await currentDecision();
  if (decision.kind !== "enter") return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const result = await supabase.rpc("set_member_active", {
    p_org: decision.organization.id,
    p_user: userId.data,
    p_active: active,
  });
  if (result.error) return { ok: false, message: "Não foi possível mudar o acesso dessa pessoa" };

  revalidatePath("/app/equipe");
  return { ok: true, message: active ? "Acesso reativado" : "Acesso desativado" };
}

/** Cancela convite ainda não aceito (o banco confere se quem pede é gestor). */
export async function cancelInvitation(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const id = z.uuid().safeParse(form.get("invitationId"));
  if (!id.success) return { ok: false, message: "Pedido inválido" };
  const result = await (await createClient()).rpc("cancel_invitation", { p_invitation: id.data });
  if (result.error) return { ok: false, message: "Não foi possível cancelar (já aceito ou sem permissão)" };
  revalidatePath("/app/equipe");
  return { ok: true, message: "Convite cancelado" };
}

/** Manda de novo o link de acesso para um convite pendente (o RLS só mostra o convite ao gestor). */
export async function resendInvitation(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const id = z.uuid().safeParse(form.get("invitationId"));
  if (!id.success) return { ok: false, message: "Pedido inválido" };
  const { data } = await (await createClient())
    .from("invitations")
    .select("email")
    .eq("id", id.data)
    .is("accepted_at", null)
    .maybeSingle();
  const email = z.object({ email: z.email() }).safeParse(data);
  if (!email.success) return { ok: false, message: "Convite não encontrado" };
  const sent = await sendAccessLink(email.data.email, (await headers()).get("origin") ?? "");
  return sent
    ? { ok: true, message: "Convite reenviado" }
    : { ok: false, message: "O e-mail não saiu. Tente de novo em alguns minutos." };
}
