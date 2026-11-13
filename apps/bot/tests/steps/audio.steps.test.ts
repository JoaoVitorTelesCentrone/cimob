import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { processAudio } from "../../src/audio/process.ts";
import type { Transcriber } from "../../src/audio/transcribe-client.ts";
import type { Extractor } from "@c1imob/ai";
import { createFlowHandler } from "../../src/flow/runner.ts";
import { TIMEFRAME } from "../../src/flow/options.ts";
import { HANDOFF_LABEL } from "../../src/flow/texts.ts";
import { createVaultTokens } from "../../src/outbound/tokens.ts";
import { Chat, optionsOf } from "../support/chat.ts";
import { BotTestDb } from "../support/db.ts";
import { audioMessage } from "../support/payloads.ts";

const feature = await loadFeature("../../features/bot/audio.feature", { language: "pt" });

const ORG = "Horizonte";
const CONTACT = "5511987654321";

describeFeature(feature, ({ Background, Scenario, AfterEachScenario }) => {
  let db: BotTestDb;
  let chat: Chat;
  let alerts: string[] = [];
  let transcriberDown = false;
  let mediaDown = false;
  let processed = false;
  /** O que cada áudio "diz" (o serviço de transcrição falso responde por aqui). */
  const audios = new Map<string, { seconds: number; text: string }>();

  AfterEachScenario(async () => {
    await db.cleanup();
  });

  const transcriber: Transcriber = (audio) => {
    if (transcriberDown)
      return Promise.resolve({ ok: false, reason: "failed", error: "ECONNREFUSED" });
    const said = audios.get(new TextDecoder().decode(audio));
    if (!said) return Promise.resolve({ ok: false, reason: "failed", error: "áudio desconhecido" });
    if (said.seconds > 60)
      return Promise.resolve({ ok: false, reason: "too_long", durationS: said.seconds });
    return Promise.resolve({ ok: true, text: said.text, durationS: said.seconds });
  };
  /** LLM falso: entende a faixa dita por extenso (o texto transcrito passa pela extração, T2.4). */
  const extractor: Extractor = (req) =>
    Promise.resolve({
      goal: null,
      budget: req.text.includes("setecentos") ? "budget_2" : null,
      timeframe: null,
      wantsVisit: null,
      name: null,
      question: null,
      wantsHuman: false,
    });

  /** Roda o worker de transcrição para os áudios que ficaram na fila (uma vez por cenário). */
  const processQueued = async () => {
    if (processed) return;
    processed = true;
    for (const id of chat.transcriptions) {
      await processAudio(db.sql, id, {
        media: (mediaId) =>
          mediaDown
            ? Promise.reject(new Error("HTTP 404"))
            : Promise.resolve({ bytes: new TextEncoder().encode(mediaId), mimeType: "audio/ogg" }),
        transcriber,
        tokens: createVaultTokens(db.sql, "EAAG-token-de-teste-longo"),
        flow: createFlowHandler({ extractor }),
        alert: (text) => {
          alerts.push(text);
          return Promise.resolve();
        },
        afterCommit: () => Promise.resolve(),
      });
    }
  };
  const lastBodies = async (n: number) =>
    (await db.outbound(ORG, CONTACT))
      .slice(-n)
      .map((m) => m.body ?? "")
      .join("\n");
  const lead = async () => {
    const row = await db.leadByPhone(ORG, CONTACT);
    if (!row) throw new Error("sem lead");
    return row;
  };
  const sendAudio = async (seconds: number, text = "") => {
    const mediaId = `MEDIA-${randomUUID()}`;
    audios.set(mediaId, { seconds, text });
    await chat.deliver(audioMessage(db.wamid(randomUUID()), CONTACT, await chat.to(), mediaId));
  };

  Background(({ Given }) => {
    Given(
      "uma conversa em andamento sobre {string} aguardando a faixa de investimento",
      async (_ctx, code: string) => {
        db = new BotTestDb();
        alerts = [];
        transcriberDown = false;
        mediaDown = false;
        processed = false;
        audios.clear();
        await db.org(ORG, "PHONE_AUDIO");
        await db.agent(ORG, "Marina");
        await db.unit(ORG, code, 765_000, "available");
        chat = new Chat(db, ORG, "PHONE_AUDIO");
        await chat.type(CONTACT, `Olá! Código: ${code}`);
        await chat.respond(CONTACT, "Morar");
      },
    );
  });

  const audioWithText = (
    When: (t: string, f: (c: unknown, s: number, text: string) => Promise<void>) => void,
  ) => {
    When(
      "o contato envia um áudio de {int} segundos dizendo {string}",
      async (_ctx, seconds: number, text: string) => {
        await sendAudio(seconds, text);
      },
    );
  };
  const asksToType = (Then: (t: string, f: () => Promise<void>) => void) => {
    Then("o bot pede para o contato digitar a resposta", async () => {
      await processQueued();
      expect(await lastBodies(2)).toMatch(/escrever/);
    });
  };
  const alerted = (And: (t: string, f: () => void) => void) => {
    And("um alerta é enviado ao grupo de operação", () => {
      expect(alerts.join("\n")).toMatch(/áudio/i);
    });
  };

  Scenario("Áudio curto é transcrito e entendido", ({ When, Then, And }) => {
    audioWithText(When);
    Then("o áudio é transcrito", async () => {
      await processQueued();
      const events = await db.events((await lead()).id);
      expect(events).toContainEqual({
        type: "audio_transcribed",
        data: { text: "uns setecentos mil, mais ou menos", seconds: 12 },
      });
    });
    And("a faixa {string} é registrada", async (_ctx, budget: string) => {
      expect((await lead()).budget_range).toBe(budget);
    });
    And("o bot segue para a pergunta de prazo", async () => {
      const last = (await db.outbound(ORG, CONTACT)).at(-1)?.payload ?? {};
      expect(optionsOf(last).map((o) => o.title)).toEqual(
        expect.arrayContaining(TIMEFRAME.map((t) => t.title)),
      );
    });
  });

  Scenario("Áudio não responde o bot antes de ser transcrito", ({ When, Then, And }) => {
    let before = 0;
    When(
      "o contato envia um áudio de {int} segundos dizendo {string}",
      async (_ctx, seconds: number, text: string) => {
        before = (await db.outbound(ORG, CONTACT)).length;
        await sendAudio(seconds, text);
      },
    );
    Then("antes da transcrição o bot não responde nada", async () => {
      expect(await db.outbound(ORG, CONTACT)).toHaveLength(before);
    });
    And("a transcrição fica na fila", () => {
      expect(chat.transcriptions).toHaveLength(1);
    });
  });

  Scenario("Áudio longo vai para o corretor", ({ When, Then, And }) => {
    When("o contato envia um áudio de {int} minutos", async (_ctx, minutes: number) => {
      await sendAudio(minutes * 60);
    });
    Then("o bot avisa que vai passar para o corretor", async () => {
      await processQueued();
      expect(await lastBodies(2)).toMatch(/corretor/);
    });
    And("o lead é atribuído com a marcação {string}", async (_ctx, label: string) => {
      expect((await lead()).owner_name).toBe("Marina");
      const reasons = (await db.events((await lead()).id))
        .filter((e) => e.type === "handoff")
        .map((e) => HANDOFF_LABEL[e.data["reason"] as keyof typeof HANDOFF_LABEL]);
      expect(reasons).toEqual([label]);
    });
  });

  Scenario("Falha na transcrição pede texto", ({ Given, When, Then, And }) => {
    Given("o serviço de transcrição está fora do ar", () => {
      transcriberDown = true;
    });
    When("o contato envia um áudio de {int} segundos", async (_ctx, seconds: number) => {
      await sendAudio(seconds);
    });
    asksToType(Then);
    alerted(And);
  });

  Scenario("Falha ao baixar o áudio da Meta também pede texto", ({ Given, When, Then, And }) => {
    Given("a Meta não entrega o arquivo do áudio", () => {
      mediaDown = true;
    });
    When("o contato envia um áudio de {int} segundos", async (_ctx, seconds: number) => {
      await sendAudio(seconds);
    });
    asksToType(Then);
    alerted(And);
  });
});
