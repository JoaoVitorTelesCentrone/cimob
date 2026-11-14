import { describe, expect, it } from "vitest";
import { step, type Extracted, type Outcome, type Snapshot } from "./machine.ts";
import { privacyNotice } from "./texts.ts";

const base: Snapshot = {
  state: "new",
  data: {},
  lead: { name: null, intent: null, budgetRange: null, timeframe: null, wantsVisit: null },
  unit: { code: "AUR-502", price: 765_000, status: "available" },
  org: { name: "Horizonte Imóveis", privacyUrl: null },
};
const at = (patch: Partial<Snapshot>): Snapshot => ({ ...base, ...patch });
const text = (t: string) => ({ text: t, replyId: null });
const reply = (id: string, t = "") => ({ text: t, replyId: id });
const allText = (o: Outcome) => o.replies.map((r) => r.body).join("\n");
const options = (o: Outcome) => {
  const last = o.replies.at(-1);
  return last && last.kind !== "text" ? last.options.map((x) => x.title) : [];
};

describe("primeira mensagem", () => {
  it("saudação com aviso de privacidade e a pergunta de objetivo com Atendente", () => {
    const o = step(base, text("Olá! Código: AUR-502"));
    expect(o.state).toBe("asking_goal");
    expect(allText(o)).toContain("assistente virtual da Horizonte Imóveis");
    expect(allText(o)).toContain(privacyNotice(null));
    expect(options(o)).toEqual(["Morar", "Investir", "Atendente"]);
    expect(o.consent).toBeNull();
  });

  it("unidade vendida: avisa e não diz que está disponível", () => {
    const o = step(
      at({ unit: { code: "AUR-703", price: 700_000, status: "sold" } }),
      text("AUR-703"),
    );
    expect(allText(o)).toMatch(/AUR-703 já foi vendida/);
    expect(allText(o)).not.toMatch(/dispon[ií]ve/i);
    expect(o.state).toBe("asking_goal");
  });

  it("'atendente' logo de cara pergunta só o nome", () => {
    const o = step(base, text("atendente"));
    expect(o.state).toBe("asking_name");
    expect(o.data.handoff).toBe("requested");
    expect(allText(o)).toMatch(/Como posso te chamar\?$/);
    expect(allText(o)).toContain(privacyNotice(null));
    expect(options(o)).toEqual([]);
  });
});

describe("perguntas", () => {
  it("resposta certa avança, grava o título e registra o consentimento uma vez", () => {
    const o = step(at({ state: "asking_goal" }), reply("goal_live", "Morar"));
    expect(o).toMatchObject({ state: "asking_budget", lead: { intent: "Morar" } });
    expect(o.consent).toBe(privacyNotice(null));
    expect(o.data.consented).toBe(true);
    expect(options(o)).toContain("R$ 600–800 mil");

    const next = step(
      at({ state: "asking_budget", data: o.data, lead: { ...base.lead, ...o.lead } }),
      reply("budget_2"),
    );
    expect(next.consent).toBeNull();
    expect(next).toMatchObject({
      state: "asking_timeframe",
      lead: { budgetRange: "R$ 600–800 mil" },
    });
  });

  it("listas usam mensagem de lista (mais de 3 opções) e botões usam botões", () => {
    const budget = step(at({ state: "asking_goal" }), reply("goal_live")).replies.at(-1);
    expect(budget?.kind).toBe("list");
    const visit = step(at({ state: "asking_timeframe" }), reply("tf_3m")).replies.at(-1);
    expect(visit?.kind).toBe("buttons");
  });

  it("visita: Sim e Ainda não viram verdadeiro e falso", () => {
    expect(step(at({ state: "asking_visit" }), reply("visit_yes")).lead).toEqual({
      wantsVisit: true,
    });
    expect(step(at({ state: "asking_visit" }), text("ainda não")).lead).toEqual({
      wantsVisit: false,
    });
  });

  it("primeira resposta não entendida repete a pergunta; a segunda passa ao corretor", () => {
    const first = step(at({ state: "asking_goal", data: { consented: true } }), text("banana"));
    expect(first).toMatchObject({ state: "asking_goal", data: { misses: 1 }, handoff: null });
    expect(first.replies.at(-1)?.body).toMatch(/^Não entendi\./);

    const second = step(at({ state: "asking_goal", data: first.data }), text("laranja"));
    expect(second).toMatchObject({ state: "handed_off", handoff: "not_understood" });
  });

  it("acertar zera a contagem de não entendidas", () => {
    const o = step(at({ state: "asking_goal", data: { misses: 1 } }), reply("goal_invest"));
    expect(o.data.misses).toBe(0);
  });
});

describe("perguntas do contato", () => {
  it("preço: responde só o valor da ficha e repete a pergunta pendente", () => {
    const o = step(at({ state: "asking_budget" }), text("qual o valor?"));
    expect(o.replies[0]?.body).toBe("O valor de tabela da unidade AUR-502 é R$ 765.000.");
    expect(allText(o)).not.toMatch(/desconto|condi[cç][aã]o|parcel|entrada/i);
    expect(o.state).toBe("asking_budget");
    expect(options(o)).toContain("R$ 600–800 mil");
    expect(o.data.misses ?? 0).toBe(0);
  });

  it("preço sem valor na ficha (ou unidade vendida): não inventa e anota para o corretor", () => {
    for (const unit of [null, { code: "AUR-9", price: null, status: "available" as const }]) {
      const o = step(at({ state: "asking_goal", unit }), text("quanto custa?"));
      expect(o.replies[0]?.body).toMatch(/Não tenho o valor confirmado/);
      expect(o.events).toEqual([
        { type: "question_for_agent", data: { question: "quanto custa?" } },
      ]);
    }
  });

  const FICHA = {
    code: "AUR-502",
    price: 765_000,
    status: "available" as const,
    areaM2: 84.5,
    bedrooms: 3,
    parking: 2,
  };

  it("área, quartos e vagas: responde pela ficha, sem anotar, e repete a pergunta", () => {
    const o = step(at({ state: "asking_budget", unit: FICHA }), text("metragem, quartos e vagas?"));
    expect(o.replies[0]?.body).toBe(
      "Pela ficha, a unidade AUR-502 tem 84,5 m², 3 quartos e 2 vagas.",
    );
    expect(o.events).toEqual([]);
    expect(o.state).toBe("asking_budget");
    expect(options(o)).toContain("R$ 600–800 mil");
    expect(o.data.misses ?? 0).toBe(0);
  });

  it("campo vazio na ficha: responde o que tem e anota o resto para o corretor", () => {
    const unit = { ...FICHA, parking: null };
    const o = step(at({ state: "asking_goal", unit }), text("qual a área e tem vaga?"));
    expect(o.replies[0]?.body).toBe(
      "Pela ficha, a unidade AUR-502 tem 84,5 m². Sobre o resto, não tenho essa informação confirmada. Anotei sua pergunta para o corretor.",
    );
    expect(o.events).toEqual([
      { type: "question_for_agent", data: { question: "qual a área e tem vaga?" } },
    ]);
  });

  it("sem nada na ficha, sem unidade ou unidade vendida: não inventa e anota", () => {
    for (const unit of [
      null,
      { ...FICHA, bedrooms: null },
      { ...FICHA, status: "sold" as const },
      { code: "AUR-9", price: null, status: "available" as const },
    ]) {
      const o = step(at({ state: "asking_goal", unit }), text("quantos quartos?"));
      expect(o.replies[0]?.body).toBe(
        "Não tenho essa informação confirmada. Anotei sua pergunta para o corretor.",
      );
      expect(o.events).toEqual([
        { type: "question_for_agent", data: { question: "quantos quartos?" } },
      ]);
    }
  });

  it("pergunta fora da ficha: diz que não tem a informação, anota e repete a pergunta", () => {
    const o = step(at({ state: "asking_timeframe" }), text("aceita pet?"));
    expect(o.replies[0]?.body).toMatch(/não tenho essa informação confirmada/i);
    expect(o.events).toEqual([{ type: "question_for_agent", data: { question: "aceita pet?" } }]);
    expect(o.state).toBe("asking_timeframe");
    expect(options(o)).toContain("Até 3 meses");
  });

  it("Atendente no meio do fluxo pergunta o nome se ainda não sabe", () => {
    const o = step(at({ state: "asking_budget" }), reply("human"));
    expect(o).toMatchObject({
      state: "asking_name",
      data: { handoff: "requested" },
      handoff: null,
    });
  });

  it("Atendente quando o nome já é conhecido passa direto", () => {
    const o = step(
      at({ state: "asking_goal", lead: { ...base.lead, name: "Ana" } }),
      text("quero um atendente"),
    );
    expect(o).toMatchObject({ state: "handed_off", handoff: "requested" });
  });
});

describe("nome e fechamento", () => {
  const filled = {
    name: null,
    intent: "Morar",
    budgetRange: "R$ 600–800 mil",
    timeframe: "Até 3 meses",
    wantsVisit: true,
  };

  it("qualificado: nome próprio, passa ao corretor e agradece pelo primeiro nome", () => {
    const o = step(at({ state: "asking_name", lead: filled }), text("ana souza"));
    expect(o).toMatchObject({
      state: "handed_off",
      handoff: "qualified",
      qualified: true,
      lead: { name: "Ana Souza" },
    });
    expect(allText(o)).toMatch(/Obrigado, Ana!/);
  });

  it("não qualificado vai para nutrição, sem corretor", () => {
    const o = step(
      at({ state: "asking_name", lead: { ...filled, timeframe: "Mais de 6 meses" } }),
      text("Carla"),
    );
    expect(o).toMatchObject({ state: "nurture", handoff: null, qualified: false });
    expect(o.events).toEqual([{ type: "nurture", data: {} }]);
  });

  it("pedido de atendente guardado vale ao receber o nome", () => {
    const o = step(at({ state: "asking_name", data: { handoff: "requested" } }), text("Bruno"));
    expect(o).toMatchObject({ state: "handed_off", handoff: "requested", lead: { name: "Bruno" } });
    expect(o.qualified).toBeNull();
  });

  it("nome inválido conta como não entendido", () => {
    const o = step(at({ state: "asking_name", data: { consented: true } }), text("123"));
    expect(o).toMatchObject({ state: "asking_name", data: { misses: 1 } });
  });
});

describe("estados finais", () => {
  it("conversa com o corretor: o bot não responde", () => {
    const o = step(at({ state: "handed_off" }), text("oi"));
    expect(o.replies).toEqual([]);
    expect(o.state).toBe("handed_off");
  });

  it("em nutrição: lembra que dá para pedir atendente", () => {
    const o = step(at({ state: "nurture" }), text("oi de novo"));
    expect(allText(o)).toMatch(/escrever atendente/);
    expect(o.state).toBe("nurture");
  });

  it("em nutrição, pedir atendente passa ao corretor", () => {
    const o = step(
      at({ state: "nurture", lead: { ...base.lead, name: "Carla" } }),
      text("atendente"),
    );
    expect(o).toMatchObject({ state: "handed_off", handoff: "requested" });
  });
});

describe("com extração do LLM", () => {
  const nothing: Extracted = {
    goal: null,
    budget: null,
    timeframe: null,
    wantsVisit: null,
    name: null,
    question: null,
    wantsHuman: false,
  };
  const said = (t: string, extraction: Partial<Extracted>) => ({
    text: t,
    replyId: null,
    extraction: { ...nothing, ...extraction },
  });

  it("vários campos de uma vez: preenche todos e pula para a primeira pergunta que falta", () => {
    const o = step(
      at({ state: "asking_goal", data: { consented: true } }),
      said("quero morar, uns 700 mil, até 3 meses", {
        goal: "goal_live",
        budget: "budget_2",
        timeframe: "tf_3m",
      }),
    );
    expect(o.lead).toEqual({
      intent: "Morar",
      budgetRange: "R$ 600–800 mil",
      timeframe: "Até 3 meses",
    });
    expect(o.state).toBe("asking_visit");
  });

  it("não sobrescreve o que o contato já respondeu", () => {
    const o = step(
      at({
        state: "asking_timeframe",
        lead: { ...base.lead, intent: "Investir", budgetRange: "Até R$ 600 mil" },
      }),
      said("morar, imediato", { goal: "goal_live", timeframe: "tf_now" }),
    );
    expect(o.lead).toEqual({ timeframe: "Imediato" });
  });

  it("entendeu outro campo mas não o da pergunta atual: guarda e repete a pergunta, sem contar erro", () => {
    const o = step(
      at({ state: "asking_goal", data: { consented: true } }),
      said("uns 700 mil", { budget: "budget_2" }),
    );
    expect(o).toMatchObject({ state: "asking_goal", lead: { budgetRange: "R$ 600–800 mil" } });
    expect(o.data.misses ?? 0).toBe(0);
  });

  it("nome: o do LLM vale mais que a frase inteira", () => {
    const filled = {
      name: null,
      intent: "Morar",
      budgetRange: "R$ 600–800 mil",
      timeframe: "Até 3 meses",
      wantsVisit: true,
    };
    const o = step(
      at({ state: "asking_name", lead: filled }),
      said("pode me chamar de ana paula", { name: "ana paula" }),
    );
    expect(o.lead.name).toBe("Ana Paula");
  });

  it("pergunta detectada pelo LLM é anotada e a pergunta atual se repete", () => {
    const o = step(at({ state: "asking_goal" }), said("tem varanda", { question: "tem varanda?" }));
    expect(o.events).toEqual([{ type: "question_for_agent", data: { question: "tem varanda?" } }]);
    expect(o.state).toBe("asking_goal");
  });

  it("respondeu e perguntou junto: avança e anota a pergunta", () => {
    const o = step(
      at({ state: "asking_goal" }),
      said("morar. aceita pet?", { goal: "goal_live", question: "aceita pet?" }),
    );
    expect(o.state).toBe("asking_budget");
    expect(o.events).toEqual([{ type: "question_for_agent", data: { question: "aceita pet?" } }]);
    expect(o.replies[0]?.body).toMatch(/Anotei sua pergunta/);
  });

  it("pedido de pessoa detectado pelo LLM", () => {
    const o = step(
      at({ state: "asking_budget" }),
      said("quero alguém de verdade", { wantsHuman: true }),
    );
    expect(o.state).toBe("asking_name");
  });

  it("na primeira mensagem aproveita objetivo, faixa e prazo, mas não o nome (o aviso vem antes)", () => {
    const o = step(base, said("Oi! quero morar, me chamo Ana", { goal: "goal_live", name: "Ana" }));
    expect(o.lead).toEqual({ intent: "Morar" });
    expect(o.state).toBe("asking_budget");
    expect(o.replies.at(-1)?.body).toMatch(/assistente virtual[\s\S]*faixa de investimento/);
  });

  it("falha do LLM vira evento llm_error e segue pelas regras", () => {
    const o = step(at({ state: "asking_goal" }), {
      text: "banana",
      replyId: null,
      extraction: null,
      extractionFailed: "timeout",
    });
    expect(o.events).toEqual([{ type: "llm_error", data: { error: "timeout" } }]);
    expect(o.replies.at(-1)?.body).toMatch(/^Não entendi\./);
  });
});

describe("áudio que não virou texto", () => {
  const audio = (outcome: "too_long" | "failed") => ({ text: null, replyId: null, audio: outcome });

  it("áudio longo passa ao corretor com a marcação própria", () => {
    const o = step(at({ state: "asking_budget", data: { consented: true } }), audio("too_long"));
    expect(o).toMatchObject({ state: "handed_off", handoff: "audio_long" });
    expect(allText(o)).toMatch(/áudio.*longo[\s\S]*corretor/);
  });

  it("falha na transcrição pede para escrever e repete a pergunta, sem contar erro", () => {
    const o = step(at({ state: "asking_budget", data: { consented: true } }), audio("failed"));
    expect(o.state).toBe("asking_budget");
    expect(o.replies[0]?.body).toMatch(/Não consegui ouvir seu áudio.*escrever/);
    expect(options(o)).toContain("R$ 600–800 mil");
    expect(o.data.misses ?? 0).toBe(0);
  });

  it("conversa com o corretor continua sem resposta do bot", () => {
    expect(step(at({ state: "handed_off" }), audio("failed")).replies).toEqual([]);
  });
});
