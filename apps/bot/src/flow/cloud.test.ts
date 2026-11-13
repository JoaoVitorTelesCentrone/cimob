import { describe, expect, it } from "vitest";
import { toCloudMessage } from "./cloud.ts";

describe("toCloudMessage", () => {
  it("texto simples", () => {
    expect(toCloudMessage("5511", { kind: "text", body: "Oi" })).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5511",
      type: "text",
      text: { body: "Oi", preview_url: false },
    });
  });

  it("botões de resposta", () => {
    const m = toCloudMessage("5511", {
      kind: "buttons",
      body: "Morar ou investir?",
      options: [
        { id: "a", title: "Morar" },
        { id: "b", title: "Investir" },
      ],
    });
    expect(m).toMatchObject({
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Morar ou investir?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "a", title: "Morar" } },
            { type: "reply", reply: { id: "b", title: "Investir" } },
          ],
        },
      },
    });
  });

  it("lista com uma seção", () => {
    const m = toCloudMessage("5511", {
      kind: "list",
      body: "Faixa?",
      button: "Ver faixas",
      options: [{ id: "x", title: "Até R$ 600 mil" }],
    });
    expect(m).toMatchObject({
      interactive: {
        type: "list",
        action: {
          button: "Ver faixas",
          sections: [{ title: "Opções", rows: [{ id: "x", title: "Até R$ 600 mil" }] }],
        },
      },
    });
  });

  it("recusa o que o WhatsApp recusaria (mais de 3 botões ou de 10 linhas)", () => {
    const four = Array.from({ length: 4 }, (_, i) => ({ id: String(i), title: `B${String(i)}` }));
    expect(() => toCloudMessage("1", { kind: "buttons", body: "x", options: four })).toThrow(
      /3 botões/,
    );
    const eleven = Array.from({ length: 11 }, (_, i) => ({
      id: String(i),
      title: `L${String(i)}`,
    }));
    expect(() =>
      toCloudMessage("1", { kind: "list", body: "x", button: "b", options: eleven }),
    ).toThrow(/10 linhas/);
  });
});
