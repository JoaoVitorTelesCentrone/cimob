import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import {
  buildConversation,
  EMPTY_CONVERSATION,
  type ConversationLine,
  type MessageRow,
} from "@/lib/leads/conversation";

const feature = await loadFeature("../../features/crm/conversa-na-ficha.feature", {
  language: "pt",
});

type TableRow = Record<string, string>;
const start = new Date("2026-11-14T10:00:00-03:00");

/** Linha da tabela do Gherkin → mensagem como vem do banco (uma por minuto, na ordem). */
const toMessage = (row: TableRow, i: number): MessageRow => {
  const at = new Date(start.getTime() + i * 60_000);
  const status = row["status"] ?? "";
  const outbound = row["de"] === "bot";
  return {
    direction: outbound ? "outbound" : "inbound",
    type: row["tipo"] || "text",
    body: row["texto"] || null,
    createdAt: at,
    sendStatus: !outbound
      ? null
      : status === "falhou"
        ? "failed"
        : status === "na fila"
          ? "pending"
          : "sent",
    deliveredAt: status === "entregue" || status === "lida" ? at : null,
    readAt: status === "lida" ? at : null,
  };
};

describeFeature(feature, ({ Scenario }) => {
  let rows: MessageRow[] = [];
  let lines: ConversationLine[] = [];

  const given = (Given: (t: string, f: (c: unknown, n: string, t: TableRow[]) => void) => void) => {
    Given("a conversa de {string} com o bot:", (_ctx, _name: string, table: TableRow[]) => {
      // Fora de ordem de propósito: quem ordena é a ficha.
      rows = table.map(toMessage).reverse();
    });
  };
  const open = (When: (t: string, f: (c: unknown, n: string) => void) => void) => {
    When("abro a ficha de {string}", () => {
      lines = buildConversation(rows);
    });
  };

  Scenario(
    "A ficha mostra a conversa em ordem com o status de entrega",
    ({ Given, When, Then, And }) => {
      given(Given);
      open(When);
      Then(
        "a conversa mostra as {int} mensagens na ordem em que aconteceram",
        (_ctx, n: number) => {
          expect(lines).toHaveLength(n);
          expect(lines.map((l) => l.text)).toEqual([
            "Olá! Código: AUR-502",
            "Oi! Qual o seu objetivo?",
            "Morar",
            "Qual a sua faixa?",
            "Pode me dizer seu nome?",
            "Obrigado!",
            "Já te passo ao corretor",
          ]);
        },
      );
      And(
        "as mensagens do bot aparecem como {string}, {string}, {string}, {string} e {string}",
        (_ctx, a: string, b: string, c: string, d: string, e: string) => {
          const bot = lines.filter((l) => l.from === "bot").map((l) => l.status);
          expect(bot).toEqual([a, b, c, d, e]);
          expect(lines.filter((l) => l.from === "contact").every((l) => l.status === null)).toBe(
            true,
          );
        },
      );
    },
  );

  Scenario("Áudio sem transcrição aparece como áudio", ({ Given, When, Then }) => {
    given(Given);
    open(When);
    Then("a conversa mostra {string}", (_ctx, text: string) => {
      expect(lines.map((l) => l.text)).toEqual([text]);
    });
  });

  Scenario("Lead sem conversa mostra um aviso", ({ Given, When, Then }) => {
    Given("{string} sem conversa com o bot", () => {
      rows = [];
    });
    open(When);
    Then("a ficha diz {string}", (_ctx, text: string) => {
      expect(lines).toEqual([]);
      expect(EMPTY_CONVERSATION).toBe(text);
    });
  });
});
