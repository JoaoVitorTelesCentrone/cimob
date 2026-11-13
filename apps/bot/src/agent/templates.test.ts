import { describe, expect, it } from "vitest";
import {
  newLeadTemplate,
  param,
  parseAgentReply,
  stageTemplate,
  STAGE_OPTIONS,
} from "./templates.ts";

describe("param", () => {
  it("tira quebra de linha e espaços repetidos (a Meta recusa) e nunca fica vazio", () => {
    expect(param("Ana\nSouza\t  aqui")).toBe("Ana Souza aqui");
    expect(param("   ")).toBe("—");
    expect(param(null)).toBe("—");
  });

  it("corta textos longos", () => {
    expect(param("a".repeat(500))).toHaveLength(200);
  });
});

describe("newLeadTemplate", () => {
  it("modelo novo_lead com 5 parâmetros e o botão Já respondi apontando para o lead", () => {
    const p = newLeadTemplate("5511911110000", {
      leadId: "L1",
      leadName: "Ana Souza",
      unit: "AUR-502",
      profile: "Morar · R$ 600–800 mil · Até 3 meses · quer visitar",
      question: "aceita pet?",
      contactLink: "https://wa.me/5511987654321",
    });
    expect(p).toMatchObject({
      messaging_product: "whatsapp",
      to: "5511911110000",
      type: "template",
      template: {
        name: "novo_lead",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Ana Souza" },
              { type: "text", text: "AUR-502" },
              { type: "text", text: "Morar · R$ 600–800 mil · Até 3 meses · quer visitar" },
              { type: "text", text: "aceita pet?" },
              { type: "text", text: "https://wa.me/5511987654321" },
            ],
          },
          {
            type: "button",
            sub_type: "quick_reply",
            index: "0",
            parameters: [{ type: "payload", payload: "responded:L1" }],
          },
        ],
      },
    });
  });
});

describe("stageTemplate", () => {
  it("modelo atualizar_lead com um botão por opção, na ordem do doc 04", () => {
    const p = stageTemplate("55", { leadId: "L1", leadName: "Ana", unit: "AUR-502" });
    const buttons = (
      p["template"] as {
        components: { type: string; index?: string; parameters: { payload?: string }[] }[];
      }
    ).components.filter((c) => c.type === "button");
    expect(buttons.map((b) => [b.index, b.parameters[0]?.payload])).toEqual(
      STAGE_OPTIONS.map((o, i) => [String(i), `stage:${o.code}:L1`]),
    );
    expect(STAGE_OPTIONS.map((o) => o.title)).toEqual([
      "Visita marcada",
      "Visita feita",
      "Proposta",
      "Sem resposta",
      "Perdido",
    ]);
  });
});

describe("parseAgentReply", () => {
  const id = "6f1c2a7e-3b9d-4c1e-9a55-0d2b7c4e8f10";
  it("entende os payloads dos botões", () => {
    expect(parseAgentReply(`responded:${id}`)).toEqual({ kind: "responded", leadId: id });
    expect(parseAgentReply(`stage:lost:${id}`)).toEqual({
      kind: "stage",
      code: "lost",
      leadId: id,
    });
  });

  it("recusa payload estranho (o corretor não escolhe id nem estágio arbitrário)", () => {
    expect(parseAgentReply("stage:won:" + id)).toBeNull();
    expect(parseAgentReply("responded:abc")).toBeNull();
    expect(parseAgentReply(null)).toBeNull();
  });
});
