import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { textMessage } from "../../tests/support/payloads.ts";
import type { InboundStore } from "./store.ts";
import { processInbound, type InboundLog, type NewMessage } from "./process.ts";

const tx = {} as postgres.TransactionSql;

function fakeStore(orgs: Record<string, string>): InboundStore & { seen: Set<string> } {
  const seen = new Set<string>();
  return {
    seen,
    findOrganization: (phone) => Promise.resolve(orgs[phone] ?? null),
    async recordInbound(_org, m, handle) {
      const conversationId = `conv-${m.from}`;
      if (seen.has(m.waMessageId)) return { isNew: false, conversationId };
      await handle({ conversationId, leadId: null, messageId: `msg-${m.waMessageId}` }, tx);
      seen.add(m.waMessageId);
      return { isNew: true, conversationId };
    },
  };
}

describe("processInbound", () => {
  it("aciona o bot com a imobiliária, a conversa e a mensagem", async () => {
    const calls: NewMessage[] = [];
    await processInbound(textMessage("w1", "5511", "P", "oi"), {
      store: fakeStore({ P: "org-1" }),
      onMessage: (m) => {
        calls.push(m);
        return Promise.resolve();
      },
      log: () => undefined,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      organizationId: "org-1",
      conversationId: "conv-5511",
      leadId: null,
      message: { waMessageId: "w1", body: "oi" },
    });
  });

  it("número desconhecido vira aviso no log, sem o telefone do contato (LGPD)", async () => {
    const logs: InboundLog[] = [];
    await processInbound(textMessage("w1", "5511987654321", "P-X", "oi"), {
      store: fakeStore({}),
      onMessage: () => Promise.reject(new Error("não devia chamar")),
      log: (e) => logs.push(e),
    });
    expect(logs).toEqual([
      { level: "warn", event: "unknown_phone_number_id", phoneNumberId: "P-X" },
    ]);
    expect(JSON.stringify(logs)).not.toContain("5511987654321");
  });

  it("entrega repetida é registrada como duplicada e não aciona o bot", async () => {
    const logs: InboundLog[] = [];
    const store = fakeStore({ P: "org-1" });
    let calls = 0;
    const deps = {
      store,
      onMessage: () => {
        calls += 1;
        return Promise.resolve();
      },
      log: (e: InboundLog) => logs.push(e),
    };
    await processInbound(textMessage("w1", "55", "P", "oi"), deps);
    await processInbound(textMessage("w1", "55", "P", "oi"), deps);
    expect(calls).toBe(1);
    expect(logs).toContainEqual({ level: "info", event: "duplicate_message", waMessageId: "w1" });
  });

  it("erro do bot sobe para a fila tentar de novo", async () => {
    await expect(
      processInbound(textMessage("w1", "55", "P", "oi"), {
        store: fakeStore({ P: "org-1" }),
        onMessage: () => Promise.reject(new Error("flow quebrou")),
        log: () => undefined,
      }),
    ).rejects.toThrow("flow quebrou");
  });

  it("depois do commit de cada mensagem nova, avisa a conversa para o envio (só uma vez)", async () => {
    const committed: string[] = [];
    const deps = {
      store: fakeStore({ P: "org-1" }),
      onMessage: () => Promise.resolve(),
      log: () => undefined,
      afterCommit: (conversationId: string) => {
        committed.push(conversationId);
        return Promise.resolve();
      },
    };
    await processInbound(textMessage("w1", "55", "P", "oi"), deps);
    await processInbound(textMessage("w1", "55", "P", "oi"), deps);
    expect(committed).toEqual(["conv-55"]);
  });

  it("se o flow falhou, não avisa o envio", async () => {
    const committed: string[] = [];
    await processInbound(textMessage("w1", "55", "P", "oi"), {
      store: fakeStore({ P: "org-1" }),
      onMessage: () => Promise.reject(new Error("x")),
      log: () => undefined,
      afterCommit: (id) => {
        committed.push(id);
        return Promise.resolve();
      },
    }).catch(() => undefined);
    expect(committed).toEqual([]);
  });
});

describe("processInbound: outras conversas", () => {
  it("avisa também as conversas que o flow marcou (ex.: o resumo ao corretor)", async () => {
    const committed: string[] = [];
    await processInbound(textMessage("w9", "55", "P", "oi"), {
      store: {
        findOrganization: () => Promise.resolve("org-1"),
        async recordInbound(_org, _m, handle) {
          await handle(
            { conversationId: "conv-lead", leadId: null, messageId: "msg-1" },
            {} as postgres.TransactionSql,
          );
          return { isNew: true, conversationId: "conv-lead" };
        },
      },
      onMessage: (m) => {
        m.notify("conv-corretor");
        return Promise.resolve();
      },
      log: () => undefined,
      afterCommit: (id) => {
        committed.push(id);
        return Promise.resolve();
      },
    });
    expect(committed).toEqual(["conv-lead", "conv-corretor"]);
  });
});

describe("processInbound: áudio", () => {
  it("o flow pede a transcrição e ela é enfileirada depois do commit", async () => {
    const queued: string[] = [];
    await processInbound(textMessage("w-audio", "55", "P", "x"), {
      store: fakeStore({ P: "org-1" }),
      onMessage: (m) => {
        m.transcribe();
        return Promise.resolve();
      },
      log: () => undefined,
      onTranscribe: (id) => {
        queued.push(id);
        return Promise.resolve();
      },
    });
    expect(queued).toEqual(["msg-w-audio"]);
  });
});
