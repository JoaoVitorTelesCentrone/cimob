import { BUDGET, GOAL, HUMAN, TIMEFRAME, VISIT, matchOption, type Option } from "./options.ts";
import { qualifies, type Criteria } from "./qualify.ts";
import {
  asksPrice,
  formatPrice,
  isQuestion,
  privacyNotice,
  properName,
  wantsHuman,
  type HandoffReason,
} from "./texts.ts";

/**
 * Máquina de estados da conversa (doc 04). Função pura: recebe o retrato da conversa e a mensagem,
 * devolve o novo estado, o que responder e o que registrar. Banco e envio ficam no runner.
 * O bot nunca inventa: preço só da ficha; o resto vira pergunta anotada para o corretor.
 */

export type FlowState =
  | "new"
  | "asking_goal"
  | "asking_budget"
  | "asking_timeframe"
  | "asking_visit"
  | "asking_name"
  | "nurture"
  | "handed_off";

export type FlowData = { misses?: number; handoff?: HandoffReason; consented?: boolean };

/** Respostas do contato, como ficam na ficha do lead (títulos que ele viu). */
export type LeadAnswers = {
  name: string | null;
  intent: string | null;
  budgetRange: string | null;
  timeframe: string | null;
  wantsVisit: boolean | null;
};

export type UnitInfo = {
  code: string;
  price: number | null;
  status: "available" | "reserved" | "sold";
};

export type Snapshot = {
  state: FlowState;
  data: FlowData;
  lead: LeadAnswers;
  unit: UnitInfo | null;
  /** `criteria` ausente: vale o critério padrão (até 6 meses e 90% do preço). */
  org: { name: string; privacyUrl: string | null; criteria?: Criteria };
};

/** O que o LLM entendeu da mensagem (ids das opções; ver @c1imob/ai). */
export type Extracted = {
  goal: string | null;
  budget: string | null;
  timeframe: string | null;
  wantsVisit: boolean | null;
  name: string | null;
  question: string | null;
  wantsHuman: boolean;
};

export type Input = {
  text: string | null;
  replyId: string | null;
  /** Extração do LLM para texto livre (nunca para botão). */
  extraction?: Extracted | null;
  /** O LLM falhou (tempo, provedor): segue pelas regras e registra `llm_error`. */
  extractionFailed?: string;
  /** Áudio que não virou texto: longo demais (vai ao corretor) ou falha (pede para escrever). */
  audio?: "too_long" | "failed";
};

export type Reply =
  | { kind: "text"; body: string }
  | { kind: "buttons"; body: string; options: Option[] }
  | { kind: "list"; body: string; button: string; options: Option[] };

export type FlowEvent =
  | { type: "question_for_agent"; data: { question: string } }
  | { type: "nurture"; data: Record<string, never> }
  | { type: "llm_error"; data: { error: string } };

export type Outcome = {
  state: FlowState;
  data: FlowData;
  /** Só os campos que mudaram. */
  lead: Partial<LeadAnswers>;
  replies: Reply[];
  events: FlowEvent[];
  /** Texto do aviso aceito, quando o contato segue a conversa pela primeira vez. */
  consent: string | null;
  /** Passar ao corretor agora (o runner distribui pelo rodízio e pausa o bot). */
  handoff: HandoffReason | null;
  /** Resultado do critério, quando o fluxo termina. */
  qualified: boolean | null;
};

const MAX_MISSES = 2;

function question(state: FlowState, prefix = ""): Reply {
  const body = (t: string) => `${prefix}${t}`;
  switch (state) {
    case "asking_goal":
      return {
        kind: "buttons",
        body: body("Você procura um imóvel para morar ou para investir?"),
        options: [...GOAL, HUMAN],
      };
    case "asking_budget":
      return {
        kind: "list",
        body: body("Qual a faixa de investimento?"),
        button: "Ver faixas",
        options: [...BUDGET, HUMAN],
      };
    case "asking_timeframe":
      return {
        kind: "list",
        body: body("Quando você pretende comprar?"),
        button: "Ver prazos",
        options: [...TIMEFRAME, HUMAN],
      };
    case "asking_visit":
      return {
        kind: "buttons",
        body: body("Quer visitar o decorado ou o imóvel?"),
        options: [...VISIT, HUMAN],
      };
    default:
      return { kind: "text", body: body("Como posso te chamar?") };
  }
}

const firstName = (name: string | null) => name?.split(" ")[0] ?? null;

function outcome(s: Snapshot, patch: Partial<Outcome>): Outcome {
  return {
    state: s.state,
    data: s.data,
    lead: {},
    replies: [],
    events: [],
    consent: null,
    handoff: null,
    qualified: null,
    ...patch,
  };
}

/** Passa ao corretor: agradece e o bot sai da conversa. */
function handOff(s: Snapshot, reason: HandoffReason, patch: Partial<Outcome> = {}): Outcome {
  const name = firstName(patch.lead?.name ?? s.lead.name);
  const thanks = name ? `Obrigado, ${name}! ` : "";
  return outcome(s, {
    ...patch,
    state: "handed_off",
    data: { ...s.data, ...patch.data, misses: 0 },
    handoff: reason,
    qualified: reason === "qualified" ? true : null,
    replies: [
      ...(patch.replies ?? []),
      { kind: "text", body: `${thanks}Um corretor vai falar com você por aqui em instantes.` },
    ],
  });
}

/** Contato pediu uma pessoa: se já sabemos o nome, passa; senão pergunta só o nome. */
function askForHuman(s: Snapshot, patch: Partial<Outcome>): Outcome {
  if (s.lead.name) return handOff(s, "requested", patch);
  return outcome(s, {
    ...patch,
    state: "asking_name",
    data: { ...s.data, ...patch.data, handoff: "requested", misses: 0 },
    replies: [{ kind: "text", body: "Claro, vou chamar um corretor. Como posso te chamar?" }],
  });
}

function finish(s: Snapshot, name: string, patch: Partial<Outcome>): Outcome {
  const lead = { ...s.lead, name };
  const withName = { ...patch, lead: { ...patch.lead, name } };
  if (s.data.handoff) return handOff(s, s.data.handoff, withName);

  const budget = BUDGET.find((b) => b.title === lead.budgetRange);
  const timeframe = TIMEFRAME.find((t) => t.title === lead.timeframe);
  const unitPrice = s.unit && s.unit.status !== "sold" ? s.unit.price : null;
  // Sem faixa ou prazo (não deveria acontecer) quem decide é o corretor.
  if (!budget || !timeframe || qualifies({ budget, timeframe, unitPrice, ...(s.org.criteria ? { criteria: s.org.criteria } : {}) })) {
    return handOff(s, "qualified", withName);
  }
  return outcome(s, {
    ...withName,
    state: "nurture",
    data: { ...s.data, ...patch.data, misses: 0 },
    qualified: false,
    events: [...(patch.events ?? []), { type: "nurture", data: {} }],
    replies: [
      {
        kind: "text",
        body: `Obrigado, ${firstName(name) ?? ""}! Anotei tudo. Quando surgir algo com o seu perfil, a gente te avisa por aqui. Se quiser falar com um corretor antes, é só escrever atendente.`,
      },
    ],
  });
}

function greet(s: Snapshot, input: Input, llmEvents: FlowEvent[]): Outcome {
  const privacy = privacyNotice(s.org.privacyUrl);
  const intro = `Olá! Sou a assistente virtual da ${s.org.name}.`;
  const x = input.extraction ?? null;
  if ((input.text && wantsHuman(input.text)) || x?.wantsHuman) {
    return outcome(s, {
      state: "asking_name",
      data: { ...s.data, handoff: "requested" },
      events: llmEvents,
      replies: [
        {
          kind: "text",
          body: `${intro} Claro, vou chamar um corretor.\n\n${privacy}\n\nComo posso te chamar?`,
        },
      ],
    });
  }
  const replies: Reply[] = [];
  if (s.unit?.status === "sold") {
    replies.push({
      kind: "text",
      body: `A unidade ${s.unit.code} já foi vendida. Um corretor pode te mostrar opções parecidas.`,
    });
  }
  // Aproveita o que veio na primeira mensagem, menos o nome (o aviso de privacidade vem antes).
  const lead = extracted(x, s.lead, false);
  const next = nextQuestion({ ...s.lead, ...lead }) ?? "asking_name";
  const ask = question(next);
  replies.push({
    ...ask,
    body: `${intro} Vou fazer umas perguntas rápidas para um corretor te atender melhor. Se preferir, toque em Atendente.\n\n${privacy}\n\n${ask.body}`,
  });
  const asked = x?.question ?? (input.text && isQuestion(input.text) ? input.text : null);
  const events: FlowEvent[] = [
    ...llmEvents,
    ...(asked ? [{ type: "question_for_agent" as const, data: { question: asked } }] : []),
  ];
  return outcome(s, { state: next, lead, replies, events });
}

function priceAnswer(s: Snapshot, asked: string): Pick<Outcome, "replies" | "events"> {
  const unit = s.unit;
  if (unit && unit.status !== "sold" && unit.price !== null) {
    return {
      replies: [
        {
          kind: "text",
          body: `O valor de tabela da unidade ${unit.code} é ${formatPrice(unit.price)}.`,
        },
      ],
      events: [],
    };
  }
  return {
    replies: [
      {
        kind: "text",
        body: "Não tenho o valor confirmado aqui. Anotei para o corretor te passar.",
      },
    ],
    events: [{ type: "question_for_agent", data: { question: asked } }],
  };
}

/** Ordem das perguntas e o campo da ficha que cada uma preenche. */
const ORDER = [
  ["asking_goal", "intent"],
  ["asking_budget", "budgetRange"],
  ["asking_timeframe", "timeframe"],
  ["asking_visit", "wantsVisit"],
  ["asking_name", "name"],
] as const satisfies readonly (readonly [FlowState, keyof LeadAnswers])[];

/** Primeira pergunta ainda sem resposta; nulo quando a ficha está completa. */
function nextQuestion(lead: LeadAnswers): FlowState | null {
  return ORDER.find(([, field]) => lead[field] === null)?.[0] ?? null;
}

const titleOf = (list: readonly Option[], id: string | null) =>
  id ? (list.find((o) => o.id === id)?.title ?? null) : null;

/** O que o LLM entendeu, só para campos que o contato ainda não respondeu. */
function extracted(
  x: Extracted | null,
  lead: LeadAnswers,
  withName: boolean,
): Partial<LeadAnswers> {
  if (!x) return {};
  const out: Partial<LeadAnswers> = {};
  const intent = titleOf(GOAL, x.goal);
  const budgetRange = titleOf(BUDGET, x.budget);
  const timeframe = titleOf(TIMEFRAME, x.timeframe);
  if (lead.intent === null && intent) out.intent = intent;
  if (lead.budgetRange === null && budgetRange) out.budgetRange = budgetRange;
  if (lead.timeframe === null && timeframe) out.timeframe = timeframe;
  if (lead.wantsVisit === null && x.wantsVisit !== null) out.wantsVisit = x.wantsVisit;
  const name = withName && lead.name === null && x.name ? properName(x.name) : null;
  if (name) out.name = name;
  return out;
}

/** Resposta da pergunta atual pelas regras: id do botão ou título digitado. */
function ruleAnswer(state: FlowState, input: Input): Partial<LeadAnswers> {
  switch (state) {
    case "asking_goal": {
      const o = matchOption(GOAL, input);
      return o ? { intent: o.title } : {};
    }
    case "asking_budget": {
      const o = matchOption(BUDGET, input);
      return o ? { budgetRange: o.title } : {};
    }
    case "asking_timeframe": {
      const o = matchOption(TIMEFRAME, input);
      return o ? { timeframe: o.title } : {};
    }
    case "asking_visit": {
      const o = matchOption(VISIT, input);
      return o ? { wantsVisit: o.id === "visit_yes" } : {};
    }
    case "asking_name": {
      if (input.replyId || !input.text || isQuestion(input.text)) return {};
      const name = properName(input.text);
      return name ? { name } : {};
    }
    default:
      return {};
  }
}

const NOTED: Reply = {
  kind: "text",
  body: "Não tenho essa informação confirmada. Anotei sua pergunta para o corretor.",
};

export function step(s: Snapshot, input: Input): Outcome {
  if (s.state === "handed_off") return outcome(s, {});
  const llmEvents: FlowEvent[] = input.extractionFailed
    ? [{ type: "llm_error", data: { error: input.extractionFailed } }]
    : [];
  if (s.state === "new") return greet(s, input, llmEvents);

  if (input.audio && s.state !== "nurture") {
    const consent = s.data.consented ? null : privacyNotice(s.org.privacyUrl);
    const here = { ...s, data: { ...s.data, consented: true } };
    const base: Partial<Outcome> = { consent, data: here.data, events: llmEvents };
    if (input.audio === "too_long") {
      return handOff(here, "audio_long", {
        ...base,
        replies: [
          {
            kind: "text",
            body: "Recebi seu áudio, mas ele é um pouco longo. Vou passar para um corretor, que escuta e continua com você.",
          },
        ],
      });
    }
    return outcome(here, {
      ...base,
      replies: [
        {
          kind: "text",
          body: "Não consegui ouvir seu áudio agora. Pode escrever a resposta, por favor?",
        },
        question(s.state),
      ],
    });
  }

  const text = input.text ?? "";
  const x = input.replyId ? null : (input.extraction ?? null);
  const human =
    input.replyId === HUMAN.id || (!input.replyId && (wantsHuman(text) || Boolean(x?.wantsHuman)));

  if (s.state === "nurture") {
    if (human) return askForHuman(s, { events: llmEvents });
    return outcome(s, {
      events: llmEvents,
      replies: [
        {
          kind: "text",
          body: "Recebido! Se quiser falar com um corretor, é só escrever atendente.",
        },
      ],
    });
  }

  // Seguiu a conversa depois do aviso: o consentimento fica registrado uma vez.
  const consent = s.data.consented ? null : privacyNotice(s.org.privacyUrl);
  const base: Partial<Outcome> = {
    consent,
    data: { ...s.data, consented: true },
    events: llmEvents,
  };
  const here = { ...s, data: { ...s.data, consented: true } };

  if (human) return askForHuman(here, base);

  if (!input.replyId && asksPrice(text)) {
    const { replies, events } = priceAnswer(s, text);
    return outcome(here, {
      ...base,
      replies: [...replies, question(s.state)],
      events: [...llmEvents, ...events],
    });
  }

  // Regra vale para o campo da pergunta atual; o LLM completa os outros. No nome, vale o LLM
  // ("pode me chamar de Ana" vira "Ana"), que separa o nome do resto da frase.
  const fromLlm = extracted(x, s.lead, true);
  const patch: Partial<LeadAnswers> = { ...fromLlm, ...ruleAnswer(s.state, input) };
  if (fromLlm.name) patch.name = fromLlm.name;

  // A pergunta que o LLM separou vale mais que a frase inteira ("morar. aceita pet?").
  const asked = input.replyId ? null : (x?.question ?? (isQuestion(text) ? text : null));
  const questionEvents: FlowEvent[] = asked
    ? [{ type: "question_for_agent", data: { question: asked } }]
    : [];

  if (Object.keys(patch).length > 0) {
    const lead = { ...s.lead, ...patch };
    const events = [...llmEvents, ...questionEvents];
    // Já pediu atendente: com o nome em mãos, passa direto (não pergunta o resto).
    const next = s.data.handoff && lead.name ? null : nextQuestion(lead);
    if (next === null) return finish(here, lead.name ?? "", { ...base, lead: patch, events });
    return outcome(here, {
      ...base,
      state: next,
      data: { ...here.data, misses: 0 },
      lead: patch,
      events,
      replies: [...(asked ? [NOTED] : []), question(next)],
    });
  }

  if (asked) {
    return outcome(here, {
      ...base,
      events: [...llmEvents, ...questionEvents],
      replies: [NOTED, question(s.state)],
    });
  }

  const misses = (s.data.misses ?? 0) + 1;
  if (misses >= MAX_MISSES) {
    return handOff(here, "not_understood", {
      ...base,
      replies: [{ kind: "text", body: "Vou te passar para um corretor, que continua daqui." }],
    });
  }
  return outcome(here, {
    ...base,
    data: { ...here.data, misses },
    replies: [question(s.state, "Não entendi. ")],
  });
}
