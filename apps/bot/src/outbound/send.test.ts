import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Chat } from "../../tests/support/chat.ts";
import { BotTestDb } from "../../tests/support/db.ts";
import { FakeMeta, META_ERRORS } from "../../tests/support/fake-meta.ts";
import { RetryLater, sendPending, type SendDeps } from "./send.ts";
import { createVaultTokens } from "./tokens.ts";

const ORG = "Horizonte";
const CONTACT = "5511987650001";

describe("sendPending", () => {
  let db: BotTestDb;
  let meta: FakeMeta;
  let alerts: string[];
  let deps: SendDeps;

  beforeEach(async () => {
    db = new BotTestDb();
    meta = new FakeMeta();
    alerts = [];
    await db.org(ORG, "PHONE_SEND");
    await db.vaultToken(ORG, "EAAG-token-de-teste-longo");
    await db.unit(ORG, "AUR-502", 765_000, "available");
    deps = {
      cloud: meta,
      tokens: createVaultTokens(db.sql, null),
      alert: (t) => {
        alerts.push(t);
        return Promise.resolve();
      },
      log: () => undefined,
    };
    const chat = new Chat(db, ORG, "PHONE_SEND");
    await chat.type(CONTACT, "Olá! Código: AUR-502");
    await chat.type(CONTACT, "qual o valor?");
  });

  afterEach(async () => {
    await db.cleanup();
  });

  it("com outro envio em andamento para a mesma conversa, adia sem mandar nada", async () => {
    const id = await db.conversationId(ORG, CONTACT);
    const other = await db.sql.reserve();
    await other`select pg_advisory_lock(hashtext(${`outbound:${id}`}))`;
    try {
      await expect(sendPending(db.sql, id, deps)).rejects.toMatchObject({ reason: "locked" });
      expect(meta.calls).toHaveLength(0);
    } finally {
      await other`select pg_advisory_unlock(hashtext(${`outbound:${id}`}))`;
      other.release();
    }
  });

  it("erro definitivo numa mensagem não impede as seguintes e gera um alerta só", async () => {
    meta.respondNext(META_ERRORS["fora da janela de 24 horas"]);
    const report = await sendPending(db.sql, await db.conversationId(ORG, CONTACT), deps);
    expect(report).toEqual({ sent: 2, failed: 1 });
    expect((await db.sendStates(ORG, CONTACT)).map((s) => s.send_status)).toEqual([
      "failed",
      "sent",
      "sent",
    ]);
    expect(alerts).toHaveLength(1);
  });

  it("limite no meio para o envio ali, preservando a ordem", async () => {
    meta.respondNext({ ok: true, waMessageId: "wamid.A" }, META_ERRORS["limite de envio"]);
    await expect(
      sendPending(db.sql, await db.conversationId(ORG, CONTACT), deps),
    ).rejects.toBeInstanceOf(RetryLater);
    expect((await db.sendStates(ORG, CONTACT)).map((s) => s.send_status)).toEqual([
      "sent",
      "pending",
      "pending",
    ]);
  });

  it("libera a trava depois de enviar (o próximo envio não fica bloqueado)", async () => {
    const id = await db.conversationId(ORG, CONTACT);
    await sendPending(db.sql, id, deps);
    const [row] = await db.sql<{ ok: boolean }[]>`
      select pg_try_advisory_lock(hashtext(${`outbound:${id}`})) as ok`;
    expect(row?.ok).toBe(true);
    await db.sql`select pg_advisory_unlock(hashtext(${`outbound:${id}`}))`;
  });

  it("sem token no cofre usa o token único do ambiente, se houver", async () => {
    await db.removeToken(ORG);
    const report = await sendPending(db.sql, await db.conversationId(ORG, CONTACT), {
      ...deps,
      tokens: createVaultTokens(db.sql, "EAAG-token-unico-do-ambiente"),
    });
    expect(report.sent).toBe(3);
    expect(meta.calls[0]?.token).toBe("EAAG-token-unico-do-ambiente");
  });

  it("conversa sem pendentes não chama a Meta", async () => {
    const id = await db.conversationId(ORG, CONTACT);
    await sendPending(db.sql, id, deps);
    const before = meta.calls.length;
    expect(await sendPending(db.sql, id, deps)).toEqual({ sent: 0, failed: 0 });
    expect(meta.calls).toHaveLength(before);
  });
});
