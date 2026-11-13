export type AlertLog =
  | { level: "error"; event: "alert"; text: string }
  | { level: "warn"; event: "alert_delivery_failed"; error: string };

const QUIET_MS = 15 * 60_000;

/**
 * Alerta para a operação (doc 02: Telegram ou e-mail). Sempre vai para o log; com Telegram
 * configurado, também para o grupo. O mesmo texto não se repete por 15 minutos (a varredura de
 * envio pode bater no mesmo problema várias vezes). Quem alerta nunca quebra por causa do alerta.
 */
export function createAlerter(opts: {
  telegram: { botToken: string; chatId: string } | null;
  fetch?: typeof globalThis.fetch;
  log: (entry: AlertLog) => void;
  now?: () => number;
}) {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const now = opts.now ?? Date.now;
  const lastSent = new Map<string, number>();

  return async (text: string): Promise<void> => {
    const last = lastSent.get(text);
    if (last !== undefined && now() - last < QUIET_MS) return;
    lastSent.set(text, now());

    opts.log({ level: "error", event: "alert", text });
    if (!opts.telegram) return;
    try {
      await doFetch(`https://api.telegram.org/bot${opts.telegram.botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: opts.telegram.chatId, text: `⚠️ c1imob bot\n${text}` }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (e) {
      opts.log({
        level: "warn",
        event: "alert_delivery_failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };
}
