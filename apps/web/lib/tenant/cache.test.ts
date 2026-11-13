import { describe, expect, it } from "vitest";
import { cachedResolver } from "./cache";

const key = { kind: "slug", value: "a" } as const;

describe("cachedResolver", () => {
  it("guarda o resultado até o TTL e consulta de novo depois", async () => {
    let now = 0;
    let calls = 0;
    const r = cachedResolver(
      () => {
        calls += 1;
        return Promise.resolve({ id: "1", slug: "a" });
      },
      { ttlMs: 1000, now: () => now },
    );
    await r(key);
    now = 999;
    await r(key);
    expect(calls).toBe(1);
    now = 1000;
    await r(key);
    expect(calls).toBe(2);
  });

  it("guarda também a ausência (404)", async () => {
    let calls = 0;
    const r = cachedResolver(
      () => {
        calls += 1;
        return Promise.resolve(null);
      },
      { ttlMs: 1000, now: () => 0 },
    );
    expect(await r(key)).toBeNull();
    await r(key);
    expect(calls).toBe(1);
  });

  it("separa chaves por tipo e valor", async () => {
    let calls = 0;
    const r = cachedResolver(
      () => {
        calls += 1;
        return Promise.resolve(null);
      },
      { ttlMs: 1000, now: () => 0 },
    );
    await r({ kind: "slug", value: "a" });
    await r({ kind: "domain", value: "a" });
    expect(calls).toBe(2);
  });

  it("não guarda erro: a próxima chamada tenta de novo", async () => {
    let calls = 0;
    const r = cachedResolver(
      () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error("fora do ar")) : Promise.resolve(null);
      },
      { ttlMs: 1000, now: () => 0 },
    );
    await expect(r(key)).rejects.toThrow("fora do ar");
    expect(await r(key)).toBeNull();
    expect(calls).toBe(2);
  });
});
