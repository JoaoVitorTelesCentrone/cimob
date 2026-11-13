import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseEnv } from "@/lib/supabase/env";
import { cachedResolver } from "./cache";
import type { TenantKey } from "./route";

const Row = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  brand: z.record(z.string(), z.unknown()),
});
export type PublicTenant = z.infer<typeof Row>;

/** Consulta pública (chave publicável): a função `resolve_tenant` só devolve dados públicos. */
async function fetchTenant(key: TenantKey): Promise<PublicTenant | null> {
  const { url, key: anonKey } = supabaseEnv();
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const result = await supabase.rpc("resolve_tenant", {
    p_slug: key.kind === "slug" ? key.value : null,
    p_domain: key.kind === "domain" ? key.value : null,
  });
  if (result.error) throw new Error(`resolve_tenant falhou: ${result.error.message}`);
  const data: unknown = result.data;
  const [row] = z.array(Row).parse(data);
  return row ?? null;
}

export const resolveTenant = cachedResolver(fetchTenant, { ttlMs: 60_000 });
