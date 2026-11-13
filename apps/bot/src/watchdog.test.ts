import { describe, expect, it } from "vitest";
import { createWatchdog, type QueueStats } from "./watchdog.ts";

const NOW = 1_800_000_000_000;

function setup(initial: Record<string, QueueStats>) {
  const state = { ...initial };
  let down = false;
  const alerts: string[] = [];
  const watchdog = createWatchdog({
    probes: Object.keys(initial).map((name) => ({
      name,
      stats: () =>
        down ? Promise.reject(new Error("ECONNREFUSED")) : Promise.resolve(state[name] as QueueStats),
    })),
    alert: (text) => {
      alerts.push(text);
      return Promise.resolve();
    },
  });
  return {
    watchdog,
    alerts,
    state,
    setDown: (v: boolean) => {
      down = v;
    },
  };
}

describe("createWatchdog", () => {
  it("na 1ª conferência só anota as falhas antigas (reiniciar o bot não alerta de novo)", async () => {
    const t = setup({ inbound: { oldestWaitingAt: null, failed: 5 } });
    await t.watchdog.check(NOW);
    expect(t.alerts).toEqual([]);
  });

  it("falhas no plural", async () => {
    const t = setup({ outbound: { oldestWaitingAt: null, failed: 0 } });
    await t.watchdog.check(NOW);
    t.state["outbound"] = { oldestWaitingAt: null, failed: 3 };
    await t.watchdog.check(NOW);
    expect(t.alerts).toEqual(["Fila outbound: 3 falhas novas (3 no total)"]);
  });

  it("falhas que somem (limpeza das antigas) não alertam nem quebram a conta", async () => {
    const t = setup({ inbound: { oldestWaitingAt: null, failed: 4 } });
    await t.watchdog.check(NOW);
    t.state["inbound"] = { oldestWaitingAt: null, failed: 1 };
    await t.watchdog.check(NOW);
    t.state["inbound"] = { oldestWaitingAt: null, failed: 2 };
    await t.watchdog.check(NOW);
    expect(t.alerts).toEqual(["Fila inbound: 1 falha nova (2 no total)"]);
  });

  it("Redis que volta é avisado uma vez", async () => {
    const t = setup({ inbound: { oldestWaitingAt: null, failed: 0 } });
    t.setDown(true);
    await t.watchdog.check(NOW);
    await t.watchdog.check(NOW);
    t.setDown(false);
    await t.watchdog.check(NOW);
    expect(t.alerts).toEqual([
      "Redis fora do ar: o bot não consegue ler as filas",
      "Redis de volta: filas legíveis",
    ]);
  });
});
