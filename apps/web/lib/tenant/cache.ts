import type { Resolver, Tenant, TenantKey } from "./route";

type Entry<T> = { at: number; value: T | null };

/** Guarda o resultado (inclusive a ausência) por `ttlMs`. Erros não são guardados. */
export function cachedResolver<T extends Tenant>(
  inner: Resolver<T>,
  { ttlMs, now = Date.now }: { ttlMs: number; now?: () => number },
): Resolver<T> {
  const entries = new Map<string, Entry<T>>();
  return async (key: TenantKey) => {
    const id = `${key.kind}:${key.value}`;
    const hit = entries.get(id);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    const value = await inner(key);
    entries.set(id, { at: now(), value });
    return value;
  };
}
