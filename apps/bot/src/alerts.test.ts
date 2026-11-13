import { describe, expect, it } from "vitest";
import { createAlerter, type AlertLog } from "./alerts.ts";

function setup(opts: { telegram?: boolean; fails?: boolean; now?: () => number } = {}) {
  const posts: { url: string; body: unknown }[] = [];
  const logs: AlertLog[] = [];
  const fetch = ((url: string, init?: RequestInit) => {
    posts.push({ url, body: JSON.parse(typeof init?.body === "string" ? init.body : "null") });
    return opts.fails
      ? Promise.reject(new Error("rede"))
      : Promise.resolve(new Response("{}", { status: 200 }));
  }) as unknown as typeof globalThis.fetch;
  const alert = createAlerter({
    telegram: opts.telegram ? { botToken: "123:abc", chatId: "-100" } : null,
    fetch,
    log: (e) => {
      logs.push(e);
    },
    ...(opts.now ? { now: opts.now } : {}),
  });
  return { alert, posts, logs };
}

describe("createAlerter", () => {
  it("sempre registra no log; com Telegram configurado, manda para o grupo", async () => {
    const { alert, posts, logs } = setup({ telegram: true });
    await alert("Falha no envio: x");
    expect(logs).toEqual([{ level: "error", event: "alert", text: "Falha no envio: x" }]);
    expect(posts).toEqual([
      {
        url: "https://api.telegram.org/bot123:abc/sendMessage",
        body: { chat_id: "-100", text: "⚠️ c1imob bot\nFalha no envio: x" },
      },
    ]);
  });

  it("sem Telegram, só o log", async () => {
    const { alert, posts, logs } = setup();
    await alert("x");
    expect(posts).toHaveLength(0);
    expect(logs).toHaveLength(1);
  });

  it("falha do Telegram não derruba quem alertou", async () => {
    const { alert, logs } = setup({ telegram: true, fails: true });
    await expect(alert("x")).resolves.toBeUndefined();
    expect(logs).toContainEqual({ level: "warn", event: "alert_delivery_failed", error: "rede" });
  });

  it("o mesmo alerta não se repete por 15 minutos", async () => {
    let t = 0;
    const { alert, posts } = setup({ telegram: true, now: () => t });
    await alert("igual");
    t = 14 * 60_000;
    await alert("igual");
    await alert("outro");
    t = 16 * 60_000;
    await alert("igual");
    expect(posts.map((p) => (p.body as { text: string }).text)).toEqual([
      "⚠️ c1imob bot\nigual",
      "⚠️ c1imob bot\noutro",
      "⚠️ c1imob bot\nigual",
    ]);
  });
});
