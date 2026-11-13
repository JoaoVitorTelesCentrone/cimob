import { randomUUID } from "node:crypto";
import { createFlowHandler } from "../../src/flow/runner.ts";
import { processInbound } from "../../src/inbound/process.ts";
import { createPostgresStore } from "../../src/inbound/store.ts";
import type { BotTestDb } from "./db.ts";
import { buttonReply, listReply, textMessage } from "./payloads.ts";

type Option = { id: string; title: string };

/** Opções (botões ou linhas de lista) de uma mensagem interativa no formato da Cloud API. */
export function optionsOf(payload: Record<string, unknown>): Option[] {
  const interactive = payload["interactive"] as
    | {
        type: string;
        action: {
          buttons?: { reply: Option }[];
          sections?: { rows: Option[] }[];
        };
      }
    | undefined;
  if (!interactive) return [];
  if (interactive.type === "button") return (interactive.action.buttons ?? []).map((b) => b.reply);
  return (interactive.action.sections ?? []).flatMap((s) => s.rows);
}

/**
 * Simula um contato no WhatsApp: a mensagem passa pelo worker de verdade (banco + flow).
 * "Responder" uma opção manda o id do botão/linha que o bot ofereceu, como o WhatsApp faz.
 */
export class Chat {
  private readonly db: BotTestDb;
  private readonly org: string;
  private readonly phoneLabel: string;
  private readonly handler: ReturnType<typeof createFlowHandler>;
  /** Áudios que pediram transcrição (o worker `transcribe` pegaria depois do commit). */
  readonly transcriptions: string[] = [];

  constructor(
    db: BotTestDb,
    org: string,
    phoneLabel: string,
    handler: ReturnType<typeof createFlowHandler> = createFlowHandler(),
  ) {
    this.db = db;
    this.org = org;
    this.phoneLabel = phoneLabel;
    this.handler = handler;
  }

  /** Entrega um payload qualquer da Cloud API (ex.: o corretor tocando num botão de modelo). */
  async deliver(payload: Record<string, unknown>): Promise<void> {
    await processInbound(payload, {
      store: createPostgresStore(this.db.sql),
      onMessage: this.handler,
      log: () => undefined,
      onTranscribe: (messageId) => {
        this.transcriptions.push(messageId);
        return Promise.resolve();
      },
    });
  }

  async to(): Promise<string> {
    return this.db.phoneNumberId(this.phoneLabel);
  }

  async type(contact: string, text: string): Promise<void> {
    await this.deliver(textMessage(this.db.wamid(randomUUID()), contact, await this.to(), text));
  }

  async respond(contact: string, title: string): Promise<void> {
    const out = await this.db.outbound(this.org, contact);
    const last = out.at(-1);
    const option = last ? optionsOf(last.payload).find((o) => o.title === title) : undefined;
    if (!option) {
      await this.type(contact, title);
      return;
    }
    const kind = (last?.payload["interactive"] as { type: string }).type;
    const build = kind === "button" ? buttonReply : listReply;
    await this.deliver(
      build(this.db.wamid(randomUUID()), contact, await this.to(), option.title, option.id),
    );
  }

  /** Texto de todas as mensagens que o bot deixou para o contato (corpo + opções). */
  async botSaid(contact: string): Promise<string[]> {
    const out = await this.db.outbound(this.org, contact);
    return out.map((m) =>
      [m.body ?? "", ...optionsOf(m.payload).map((o) => `[${o.title}]`)].join(" "),
    );
  }
}
