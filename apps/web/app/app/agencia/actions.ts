"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { parseNewOrg } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { sendAccessLink } from "@/lib/supabase/access-link";
import type { ActionResult } from "@/lib/team";

/** Cria a imobiliária e convida o gestor. O banco confere se quem pede é da Center One. */
export async function createOrganization(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const input = parseNewOrg(Object.fromEntries(form));
  if (!input.ok) return { ok: false, message: input.message };
  const v = input.value;

  const supabase = await createClient();
  const result = await supabase.rpc("create_organization", {
    p_name: v.name,
    p_slug: v.slug,
    p_admin_email: v.adminEmail,
    p_admin_name: v.adminName,
  });
  if (result.error || !z.uuid().safeParse(result.data).success) {
    return result.error?.code === "23505"
      ? { ok: false, message: `O endereço "${v.slug}" já está em uso.` }
      : { ok: false, message: "Não foi possível criar a imobiliária." };
  }

  const sent = await sendAccessLink(v.adminEmail, (await headers()).get("origin") ?? "");
  revalidatePath("/app/agencia");
  return {
    ok: true,
    message: sent
      ? `Imobiliária criada. Convite enviado para ${v.adminEmail}.`
      : `Imobiliária criada, mas o e-mail não saiu. Peça a ${v.adminEmail} para entrar pelo login.`,
  };
}
