"use server";

import { revalidatePath } from "next/cache";
import { currentDecision } from "@/lib/org";
import {
  parseAdsAccount,
  parseBrand,
  parseCriteria,
  parsePhoneNumberId,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/team";

/** Texto de um campo do formulário (arquivo ou ausente vira vazio). */
const value = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

async function orgId(): Promise<string | null> {
  const decision = await currentDecision();
  return decision.kind === "enter" ? decision.organization.id : null;
}

/** Marca (cor, CRECI, WhatsApp do site, aviso de privacidade). O RLS só deixa o gestor gravar. */
export async function saveBrand(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const input = parseBrand(Object.fromEntries(form));
  if (!input.ok) return { ok: false, message: input.message };
  const id = await orgId();
  if (!id) return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const current = await supabase.from("organizations").select("brand").eq("id", id).single();
  // Campo vazio sai da marca (o site não mostra o que não existe); o resto do brand fica como está.
  const merged = { ...(current.data?.brand as Record<string, unknown>), ...input.value };
  const brand = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null));
  const updated = await supabase.from("organizations").update({ brand }).eq("id", id).select("id");
  if (updated.error || updated.data.length === 0) {
    return { ok: false, message: "Só o gestor muda a marca" };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Marca salva" };
}

export async function saveCriteria(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const input = parseCriteria(Object.fromEntries(form));
  if (!input.ok) return { ok: false, message: input.message };
  const id = await orgId();
  if (!id) return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const updated = await supabase.from("organizations").update(input.value).eq("id", id).select("id");
  if (updated.error || updated.data.length === 0) {
    return { ok: false, message: "Só o gestor muda o critério" };
  }
  revalidatePath("/app/config");
  return { ok: true, message: "Critério salvo. Vale para os próximos leads." };
}

/** Número do bot (só a Center One). Token vazio mantém o que está no cofre. */
export async function saveWhatsappAccount(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const phone = parsePhoneNumberId(value(form, "phoneNumberId"));
  if (!phone.ok) return { ok: false, message: phone.message };
  const id = await orgId();
  if (!id) return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const result = await supabase.rpc("set_whatsapp_account", {
    p_org: id,
    p_phone_number_id: phone.value,
    p_token: value(form, "token"),
  });
  if (result.error) {
    return result.error.code === "23505"
      ? { ok: false, message: "Esse número já está em outra imobiliária" }
      : { ok: false, message: "Só a Center One configura o número do bot" };
  }
  revalidatePath("/app/config");
  return { ok: true, message: "WhatsApp do bot salvo" };
}

export async function saveAdsAccount(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const account = parseAdsAccount(value(form, "adAccountId"));
  if (!account.ok) return { ok: false, message: account.message };
  const id = await orgId();
  if (!id) return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const result = await supabase.rpc("set_meta_ads_account", {
    p_org: id,
    p_ad_account_id: account.value,
    p_token: value(form, "token"),
  });
  if (result.error) {
    return result.error.code === "23505"
      ? { ok: false, message: "Essa conta de anúncios já está em outra imobiliária" }
      : { ok: false, message: "Só a Center One configura a conta de anúncios" };
  }
  revalidatePath("/app/config");
  return { ok: true, message: "Conta de anúncios salva" };
}
