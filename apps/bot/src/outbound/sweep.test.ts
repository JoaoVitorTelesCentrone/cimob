import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Chat } from "../../tests/support/chat.ts";
import { BotTestDb } from "../../tests/support/db.ts";
import { stalePendingConversations } from "./sweep.ts";

describe("stalePendingConversations", () => {
  let db: BotTestDb;

  beforeEach(async () => {
    db = new BotTestDb();
    await db.org("Horizonte", "PHONE_SWEEP");
    await new Chat(db, "Horizonte", "PHONE_SWEEP").type("5511987650002", "Olá");
  });

  afterEach(async () => {
    await db.cleanup();
  });

  it("acha a conversa com resposta pendente há mais tempo que o limite", async () => {
    const id = await db.conversationId("Horizonte", "5511987650002");
    expect(await stalePendingConversations(db.sql, 0)).toContain(id);
  });

  it("ignora pendentes recentes (o gatilho do commit ainda está cuidando delas)", async () => {
    const id = await db.conversationId("Horizonte", "5511987650002");
    expect(await stalePendingConversations(db.sql, 60_000)).not.toContain(id);
  });

  it("ignora conversas sem pendentes", async () => {
    const id = await db.conversationId("Horizonte", "5511987650002");
    await db.sql`update messages set send_status = 'sent' where conversation_id = ${id} and direction = 'outbound'`;
    expect(await stalePendingConversations(db.sql, 0)).not.toContain(id);
  });
});
