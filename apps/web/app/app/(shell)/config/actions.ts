"use server";

import { revalidatePath } from "next/cache";
import { currentDecision } from "@/lib/org";
import {
  parseAdsAccount,
  parseBrand,
  parseBusinessHoursForm,
  parseCriteria,
  parseLogo,
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
  revalidatePath("/app/config");
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
  const updated = await supabase
    .from("organizations")
    .update(input.value)
    .eq("id", id)
    .select("id");
  if (updated.error || updated.data.length === 0) {
    return { ok: false, message: "Só o gestor muda o critério" };
  }
  revalidatePath("/app/config");
  return { ok: true, message: "Critério salvo. Vale para os próximos leads." };
}

/** Horário de atendimento: o alerta de 2 h conta só dentro dele. O banco só deixa o gestor gravar. */
export async function saveBusinessHours(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const input = parseBusinessHoursForm({
    enabled: form.get("enabled"),
    days: form.getAll("days"),
    open: form.get("open"),
    close: form.get("close"),
  });
  if (!input.ok) return { ok: false, message: input.message };
  const id = await orgId();
  if (!id) return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const updated = await supabase
    .from("organizations")
    .update({ business_hours: input.value })
    .eq("id", id)
    .select("id");
  if (updated.error || updated.data.length === 0) {
    return { ok: false, message: "Só o gestor muda o horário de atendimento" };
  }
  revalidatePath("/app/config");
  return { ok: true, message: "Horário salvo" };
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

/** Grava o brand com uma mudança (lido do banco para não apagar o resto). */
async function patchBrand(id: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const current = await supabase.from("organizations").select("brand").eq("id", id).single();
  const merged = { ...(current.data?.brand as Record<string, unknown>), ...patch };
  const brand = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null));
  return supabase.from("organizations").update({ brand }).eq("id", id).select("id");
}

/** Logo no Storage (bucket brand, pasta da imobiliária); o RLS do Storage só deixa o gestor. */
export async function uploadLogo(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const file = form.get("logo");
  if (!(file instanceof File)) return { ok: false, message: "Escolha a imagem do logo." };
  const input = parseLogo(file);
  if (!input.ok) return { ok: false, message: input.message };
  const id = await orgId();
  if (!id) return { ok: false, message: "Escolha uma imobiliária" };

  const supabase = await createClient();
  const path = `${id}/logo.${input.value.ext}`;
  const uploaded = await supabase.storage
    .from("brand")
    .upload(path, file, { upsert: true, contentType: input.value.type, cacheControl: "3600" });
  if (uploaded.error) return { ok: false, message: "Só o gestor muda o logo" };

  // ?v= troca a URL a cada envio: o site não fica com o logo antigo em cache.
  const url = `${supabase.storage.from("brand").getPublicUrl(path).data.publicUrl}?v=${String(Date.now())}`;
  const saved = await patchBrand(id, { logoUrl: url });
  if (saved.error || saved.data.length === 0)
    return { ok: false, message: "Só o gestor muda o logo" };
  revalidatePath("/app/config");
  return { ok: true, message: "Logo salvo" };
}

export async function removeLogo(): Promise<ActionResult> {
  const id = await orgId();
  if (!id) return { ok: false, message: "Escolha uma imobiliária" };
  const saved = await patchBrand(id, { logoUrl: null });
  if (saved.error || saved.data.length === 0)
    return { ok: false, message: "Só o gestor muda o logo" };
  revalidatePath("/app/config");
  return { ok: true, message: "Logo removido" };
}
