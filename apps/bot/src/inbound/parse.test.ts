import { describe, expect, it } from "vitest";
import {
  adTextMessage,
  audioMessage,
  buttonReply,
  envelope,
  readStatus,
  textMessage,
} from "../../tests/support/payloads.ts";
import { parseInbound } from "./parse.ts";

/** Uma mensagem qualquer dentro do envelope da Cloud API. */
const single = (message: Record<string, unknown>) =>
  envelope("P", { messages: [{ from: "55", id: "w", timestamp: "1", ...message }] });

describe("parseInbound", () => {
  it("lê texto: número que recebeu, id, contato, horário e corpo", () => {
    const [m] = parseInbound(textMessage("wamid.1", "5511987654321", "PHONE", "Olá"));
    expect(m).toMatchObject({
      phoneNumberId: "PHONE",
      waMessageId: "wamid.1",
      from: "5511987654321",
      contactName: "Contato",
      sentAt: new Date(1763000000 * 1000),
      type: "text",
      body: "Olá",
    });
    expect(m?.raw).toMatchObject({ id: "wamid.1", type: "text" });
  });

  it("mensagem de anúncio click-to-WhatsApp traz o id do anúncio", () => {
    const [m] = parseInbound(adTextMessage("wamid.9", "5511987654321", "PHONE", "Olá", "ad_1"));
    expect(m?.adId).toBe("ad_1");
  });

  it("sem referral, ou com referral que não é de anúncio, não há anúncio", () => {
    const [plain] = parseInbound(textMessage("wamid.1", "5511987654321", "PHONE", "Olá"));
    expect(plain?.adId).toBeNull();
    const [post] = parseInbound(
      single({ type: "text", text: { body: "Oi" }, referral: { source_type: "post", source_id: "p1" } }),
    );
    expect(post?.adId).toBeNull();
  });

  it("resposta de botão e de lista viram o título mostrado, com o id da opção", () => {
    const [b] = parseInbound(buttonReply("w", "55", "P", "Morar", "goal_live"));
    expect(b).toMatchObject({ type: "interactive", body: "Morar", replyId: "goal_live" });

    const list = single({
      type: "interactive",
      interactive: { type: "list_reply", list_reply: { id: "budget_2", title: "R$ 600–800 mil" } },
    });
    expect(parseInbound(list)[0]).toMatchObject({ body: "R$ 600–800 mil", replyId: "budget_2" });
  });

  it("botão de template (quick reply) usa o texto do botão", () => {
    const p = single({ type: "button", button: { text: "Quero visitar", payload: "visit_yes" } });
    expect(parseInbound(p)[0]).toMatchObject({
      type: "button",
      body: "Quero visitar",
      replyId: "visit_yes",
    });
  });

  it("áudio, imagem e figurinha ficam sem texto (o tipo diz o que é)", () => {
    expect(parseInbound(audioMessage("w", "55", "P"))[0]).toMatchObject({
      type: "audio",
      body: null,
      replyId: null,
    });
  });

  it("legenda de imagem vira o texto", () => {
    const p = single({ type: "image", image: { caption: "planta" } });
    expect(parseInbound(p)[0]).toMatchObject({ type: "image", body: "planta" });
  });

  it("avisos de entrega e leitura não são mensagens", () => {
    expect(parseInbound(readStatus("P"))).toEqual([]);
  });

  it("lote com várias mensagens e várias entradas devolve todas, na ordem", () => {
    const a = textMessage("w1", "55", "P1", "a");
    const b = textMessage("w2", "56", "P2", "b");
    const both = { object: "whatsapp_business_account", entry: [...a.entry, ...b.entry] };
    expect(parseInbound(both).map((m) => [m.phoneNumberId, m.waMessageId])).toEqual([
      ["P1", "w1"],
      ["P2", "w2"],
    ]);
  });

  it("ignora o que não é do WhatsApp ou vem malformado, sem derrubar o lote", () => {
    expect(parseInbound({ object: "page", entry: [] })).toEqual([]);
    expect(parseInbound({})).toEqual([]);
    const broken = envelope("P", {
      messages: [
        { id: "sem-from" },
        { from: "55", id: "ok", timestamp: "1", type: "text", text: { body: "oi" } },
      ],
    });
    expect(parseInbound(broken).map((m) => m.waMessageId)).toEqual(["ok"]);
  });

  it("texto muito longo é cortado em 4.096 caracteres (limite do WhatsApp)", () => {
    const [m] = parseInbound(textMessage("w", "55", "P", "a".repeat(5000)));
    expect(m?.body).toHaveLength(4096);
  });
});
