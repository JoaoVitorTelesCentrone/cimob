import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectRealtime,
  createRefreshScheduler,
  realtimeSubscriptions,
  REFRESH_DELAY_MS,
} from "./realtime";

describe("createRefreshScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("espera a rajada acabar antes de recarregar", () => {
    const refresh = vi.fn();
    const s = createRefreshScheduler(refresh);
    s.notify();
    vi.advanceTimersByTime(REFRESH_DELAY_MS - 1);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("junta várias mudanças seguidas num recarregamento só", () => {
    const refresh = vi.fn();
    const s = createRefreshScheduler(refresh, 100);
    s.notify();
    vi.advanceTimersByTime(50);
    s.notify();
    vi.advanceTimersByTime(50);
    s.notify();
    vi.advanceTimersByTime(100);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("cancelar impede o recarregamento pendente (tela fechada)", () => {
    const refresh = vi.fn();
    const s = createRefreshScheduler(refresh, 100);
    s.notify();
    s.cancel();
    vi.advanceTimersByTime(1000);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("realtimeSubscriptions", () => {
  it("uma assinatura por tabela, sempre filtrada pela organização", () => {
    expect(realtimeSubscriptions("org-1", ["leads"])).toEqual([
      { table: "leads", filter: "organization_id=eq.org-1" },
    ]);
  });
});

describe("connectRealtime", () => {
  type Handler = () => void;
  const fakeClient = (token: string | null) => {
    const calls: string[] = [];
    const handlers: Handler[] = [];
    let authListener: ((event: string, session: { access_token: string } | null) => void) | null =
      null;
    const channel = {
      on(_type: string, filter: { table: string; filter: string }, cb: Handler) {
        calls.push(`on:${filter.table}:${filter.filter}`);
        handlers.push(cb);
        return channel;
      },
      subscribe() {
        calls.push("subscribe");
        return channel;
      },
    };
    const client = {
      auth: {
        getSession: () => {
          calls.push("getSession");
          return Promise.resolve({ data: { session: token ? { access_token: token } : null } });
        },
        onAuthStateChange(cb: NonNullable<typeof authListener>) {
          authListener = cb;
          return { data: { subscription: { unsubscribe: () => calls.push("auth:unsubscribe") } } };
        },
      },
      realtime: {
        setAuth: (t: string | null) => {
          calls.push(`setAuth:${String(t)}`);
          return Promise.resolve();
        },
      },
      channel: (name: string) => {
        calls.push(`channel:${name}`);
        return channel;
      },
      removeChannel: () => {
        calls.push("removeChannel");
        return Promise.resolve("ok");
      },
    };
    return {
      client,
      calls,
      fire: () => {
        for (const h of handlers) h();
      },
      refreshToken: (t: string) => authListener?.("TOKEN_REFRESHED", { access_token: t }),
    };
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("entrega o token da sessão ao Realtime antes de assinar (sem ele, o RLS trata como anônimo)", async () => {
    const f = fakeClient("tok-1");
    connectRealtime(f.client, { organizationId: "org-1", tables: ["leads"], onChange: () => {} });
    await flush();
    expect(f.calls.indexOf("setAuth:tok-1")).toBeGreaterThan(-1);
    expect(f.calls.indexOf("setAuth:tok-1")).toBeLessThan(f.calls.indexOf("subscribe"));
    expect(f.calls).toContain("on:leads:organization_id=eq.org-1");
  });

  it("repassa o token renovado", async () => {
    const f = fakeClient("tok-1");
    connectRealtime(f.client, { organizationId: "org-1", tables: ["leads"], onChange: () => {} });
    await flush();
    f.refreshToken("tok-2");
    expect(f.calls).toContain("setAuth:tok-2");
  });

  it("avisa a cada mudança e para de escutar ao desconectar", async () => {
    const f = fakeClient("tok-1");
    let changes = 0;
    const stop = connectRealtime(f.client, {
      organizationId: "org-1",
      tables: ["units", "properties"],
      onChange: () => (changes += 1),
    });
    await flush();
    f.fire();
    expect(changes).toBe(2);
    stop();
    expect(f.calls).toContain("removeChannel");
    expect(f.calls).toContain("auth:unsubscribe");
  });

  it("desconectar antes da sessão carregar não abre canal", async () => {
    const f = fakeClient("tok-1");
    const stop = connectRealtime(f.client, {
      organizationId: "o",
      tables: ["leads"],
      onChange: () => {},
    });
    stop();
    await flush();
    expect(f.calls).not.toContain("subscribe");
  });
});
