import { describe, expect, it } from "vitest";
import { buildConversation, deliveryLabel, type MessageRow } from "./conversation";

const at = new Date("2026-11-14T10:00:00-03:00");
const msg = (over: Partial<MessageRow>): MessageRow => ({
  direction: "outbound",
  type: "text",
  body: "Oi",
  createdAt: at,
  sendStatus: "sent",
  deliveredAt: null,
  readAt: null,
  ...over,
});

describe("deliveryLabel", () => {
  it("só mensagens do bot têm status; vale o mais avançado", () => {
    expect(deliveryLabel(msg({ direction: "inbound", sendStatus: null }))).toBeNull();
    expect(deliveryLabel(msg({ sendStatus: "pending" }))).toBe("Na fila");
    expect(deliveryLabel(msg({}))).toBe("Enviada");
    expect(deliveryLabel(msg({ deliveredAt: at }))).toBe("Entregue");
    expect(deliveryLabel(msg({ deliveredAt: at, readAt: at }))).toBe("Lida");
    // Recusa vale mais que tudo: a Meta pode avisar a falha depois de aceitar.
    expect(deliveryLabel(msg({ sendStatus: "failed", deliveredAt: at }))).toBe("Não entregue");
  });
});

describe("buildConversation", () => {
  it("ordena pela hora e marca quem falou", () => {
    const later = new Date(at.getTime() + 60_000);
    const lines = buildConversation([
      msg({ body: "segunda", createdAt: later }),
      msg({ direction: "inbound", body: "primeira", sendStatus: null }),
    ]);
    expect(lines.map((l) => [l.from, l.text])).toEqual([
      ["contact", "primeira"],
      ["bot", "segunda"],
    ]);
    expect(lines[0]?.at).toEqual(at);
  });

  it("mensagem sem texto mostra o tipo", () => {
    const lines = buildConversation([
      msg({ direction: "inbound", type: "audio", body: null, sendStatus: null }),
      msg({ direction: "inbound", type: "image", body: null, sendStatus: null }),
      msg({ type: "template", body: null }),
    ]);
    expect(lines.map((l) => l.text)).toEqual([
      "Áudio (sem transcrição)",
      "Imagem",
      "Mensagem modelo do WhatsApp",
    ]);
    expect(buildConversation([msg({ type: "reaction", body: null })])[0]?.text).toBe(
      "Mensagem sem texto",
    );
  });
});
