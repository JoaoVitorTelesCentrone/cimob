import { describe, expect, it } from "vitest";
import { describeEvent } from "./history";

const names = new Map([
  ["u-marina", "Marina"],
  ["u-paula", "Paula"],
]);
const d = (type: string, data: Record<string, unknown> = {}, actorId: string | null = null) =>
  describeEvent({ type, data, actorId }, names);

describe("describeEvent", () => {
  it("mudança de estágio mostra de/para, quem mudou e o motivo da perda", () => {
    expect(d("stage_changed", { from: "new", to: "qualified" }, "u-paula")).toEqual({
      title: "Novo → Qualificado",
      detail: "por Paula",
    });
    expect(d("stage_changed", { from: "contacted", to: "lost", reason: "Comprou com outra" })).toEqual({
      title: "Em atendimento → Perdido",
      detail: "motivo: Comprou com outra",
    });
  });

  it("atribuição mostra quem recebeu e como", () => {
    expect(d("assigned", { to: "u-marina", by: "rotation" })).toEqual({
      title: "Atribuído a Marina",
      detail: "pelo rodízio",
    });
    expect(d("assigned", { to: "u-desconhecido" })).toEqual({ title: "Atribuído a outro membro", detail: null });
  });

  it("eventos do bot em português", () => {
    expect(d("handoff", { reason: "qualified", assigned: true })).toEqual({
      title: "Passado ao corretor",
      detail: "qualificado",
    });
    expect(d("handoff", { reason: "requested", assigned: false })).toEqual({
      title: "Passado ao corretor",
      detail: "pediu atendente · ninguém no rodízio",
    });
    expect(d("question_for_agent", { question: "Aceita permuta?" })).toEqual({
      title: "Pergunta para o corretor",
      detail: "“Aceita permuta?”",
    });
    expect(d("nurture")).toEqual({ title: "Foi para nutrição", detail: "fora do critério de qualificação" });
    expect(d("audio_transcribed", { text: "uns 700 mil", seconds: 12 })).toEqual({
      title: "Áudio transcrito (12 s)",
      detail: "“uns 700 mil”",
    });
    expect(d("agent_reply", { via: "button" })).toEqual({ title: "Corretor respondeu", detail: "pelo WhatsApp" });
  });

  it("tipo desconhecido aparece como veio, sem quebrar", () => {
    expect(d("algo_novo", { x: 1 })).toEqual({ title: "algo_novo", detail: null });
  });
});
