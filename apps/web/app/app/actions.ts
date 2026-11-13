"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { myOrganizations, ORG_COOKIE } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export async function selectOrganization(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("organizationId"));
  if (!id.success) redirect("/app/escolher");
  // Só aceita organização da qual o usuário é membro (o RLS já filtra a lista).
  const orgs = await myOrganizations();
  if (!orgs.some((o) => o.id === id.data)) redirect("/app/escolher");
  (await cookies()).set(ORG_COOKIE, id.data, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/app");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ORG_COOKIE);
  redirect("/login");
}
