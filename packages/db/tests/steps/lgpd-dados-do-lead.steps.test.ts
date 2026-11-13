import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/lgpd-dados-do-lead.feature", {
  language: "pt",
});

type TableRow = Record<string, string>;
type Exported = {
  lead: { name: string; phone: string };
  messages: { direction: string; body: string | null }[];
  consents: { scope: string; text_shown: string }[];
};

const PRIVACY_TEXT = "Usamos seus dados só para o atendimento. Aviso: https://exemplo/privacidade";

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let exported: Exported | null = null;
  let dbError: string | null = null;
  let anonErrors: (string | null)[] = [];

  AfterEachScenario(async () => {
    await s.end();
  });

  const leadId = (name: string) => s.leads.get(name) ?? "";
  const userId = (name: string) => s.users.get(name) ?? "";
  const count = async (query: Promise<{ n: number }[]>) => (await query)[0]?.n ?? 0;

  const exportAs = async (user: string, lead: string) => {
    exported = null;
    dbError = await s.expectError(async () => {
      const [row] = await s.as(
        user,
        (c) => c<{ data: Exported }[]>`select public.export_lead_data(${leadId(lead)}) as data`,
      );
      exported = row?.data ?? null;
    });
  };
  const deleteAs = async (user: string, lead: string) => {
    dbError = await s.expectError(() =>
      s.as(user, (c) => c`select public.delete_lead_data(${leadId(lead)})`),
    );
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com a gestora {string} e a corretora {string}",
      async (_ctx, org: string, admin: string, agent: string) => {
        s = await Scenario.begin();
        exported = null;
        dbError = null;
        anonErrors = [];
        await s.org(org);
        await s.member(admin, org, "org_admin");
        await s.member(agent, org, "agent");
      },
    );
    And("a imobiliária {string} com o gestor {string}", async (_ctx, org: string, admin: string) => {
      await s.org(org);
      await s.member(admin, org, "org_admin");
    });
    And(
      "o lead {string} da {string}, telefone {string}, com a corretora {string}",
      async (_ctx, lead: string, org: string, phone: string, agent: string) => {
        await s.lead(org, lead, phone, agent);
      },
    );
    And(
      "a conversa de {string} com as mensagens:",
      async (_ctx, lead: string, table: TableRow[]) => {
        const conv = randomUUID();
        const [l] = await s.conn<{ organization_id: string; phone: string }[]>`
          select organization_id, phone from leads where id = ${leadId(lead)}`;
        await s.conn`insert into conversations (id, organization_id, lead_id, wa_contact)
                     values (${conv}, ${l?.organization_id ?? ""}, ${leadId(lead)}, ${l?.phone ?? ""})`;
        // Horários explícitos: na mesma transação o now() é igual para todas as linhas.
        for (const [i, row] of table.entries()) {
          await s.conn`
            insert into messages (organization_id, conversation_id, wa_message_id, direction, send_status, type, body, created_at)
            values (${l?.organization_id ?? ""}, ${conv},
                    ${row["direção"] === "entrada" ? `wamid.${randomUUID()}` : null},
                    ${row["direção"] === "entrada" ? "inbound" : "outbound"},
                    ${row["direção"] === "entrada" ? null : "sent"}, 'text', ${row["texto"] ?? ""},
                    ${new Date(Date.now() - (table.length - i) * 60_000)})`;
        }
        s.conversations.set(lead, conv);
      },
    );
    And("{string} aceitou o aviso de privacidade", async (_ctx, lead: string) => {
      const [c] = await s.conn<{ organization_id: string }[]>`
        select organization_id from conversations where id = ${s.conversations.get(lead) ?? ""}`;
      await s.conn`insert into consents (organization_id, conversation_id, scope, text_shown)
                   values (${c?.organization_id ?? ""}, ${s.conversations.get(lead) ?? ""}, 'privacy_notice', ${PRIVACY_TEXT})`;
      await s.conn`insert into lead_events (organization_id, lead_id, type, data)
                   values (${c?.organization_id ?? ""}, ${leadId(lead)}, 'consent', '{}')`;
    });
    And(
      "o resumo de {string} foi enviado ao WhatsApp de {string}",
      async (_ctx, lead: string, agent: string) => {
        const [l] = await s.conn<{ organization_id: string }[]>`
          select organization_id from leads where id = ${leadId(lead)}`;
        const org = l?.organization_id ?? "";
        const conv = randomUUID();
        await s.conn`insert into conversations (id, organization_id, wa_contact, agent_user_id)
                     values (${conv}, ${org}, '5511977700001', ${userId(agent)})`;
        await s.conn`
          insert into messages (organization_id, conversation_id, direction, send_status, type, body, payload)
          values (${org}, ${conv}, 'outbound', 'sent', 'template', ${`Novo lead: ${lead}`},
                  ${s.conn.json({ type: "template", buttons: [`responded:${leadId(lead)}`] })})`;
        // Outra mensagem na conversa do corretor, de outro assunto, que deve ficar.
        await s.conn`
          insert into messages (organization_id, conversation_id, direction, send_status, type, body)
          values (${org}, ${conv}, 'outbound', 'sent', 'text', 'Bom dia, equipe!')`;
        s.conversations.set(`agent:${agent}`, conv);
      },
    );
    And("o lead {string} da {string} com uma conversa", async (_ctx, lead: string, org: string) => {
      await s.lead(org, lead);
      await s.conversation(org, lead, { lead, message: "Oi, quero saber do Aurora" });
    });
  });

  Sc("Gestora exporta os dados do lead", ({ When, Then, And }) => {
    When("{string} exporta os dados de {string}", async (_ctx, user: string, lead: string) => {
      await exportAs(user, lead);
    });
    Then(
      "a exportação traz o nome {string} e o telefone {string}",
      (_ctx, name: string, phone: string) => {
        expect(dbError).toBeNull();
        expect(exported?.lead).toMatchObject({ name, phone });
      },
    );
    And("a exportação traz as {int} mensagens da conversa, na ordem", (_ctx, n: number) => {
      expect(exported?.messages.map((m) => m.direction)).toEqual(["inbound", "outbound"].slice(0, n));
      expect(exported?.messages[0]?.body).toBe("Olá! Código: AUR-502");
    });
    And("a exportação traz o consentimento com o texto mostrado", () => {
      expect(exported?.consents).toEqual([
        expect.objectContaining({ scope: "privacy_notice", text_shown: PRIVACY_TEXT }),
      ]);
    });
    And(
      "o histórico de {string} registra a exportação feita por {string}",
      async (_ctx, lead: string, user: string) => {
        const rows = await s.conn<{ actor_id: string | null }[]>`
          select actor_id from lead_events where lead_id = ${leadId(lead)} and type = 'data_exported'`;
        expect(rows.map((r) => r.actor_id)).toEqual([userId(user)]);
      },
    );
  });

  const refused = (Then: (t: string, f: () => void) => void) => {
    Then("o banco recusa", () => {
      expect(dbError).not.toBeNull();
    });
  };
  const stillThere = (And: (t: string, f: (ctx: unknown, lead: string) => Promise<void>) => void) => {
    And("o lead {string} continua", async (_ctx, lead: string) => {
      expect(await count(s.conn`select count(*)::int as n from leads where id = ${leadId(lead)}`)).toBe(1);
    });
  };

  Sc("Corretora dona do lead não exporta", ({ When, Then }) => {
    When("{string} exporta os dados de {string}", async (_ctx, user: string, lead: string) => {
      await exportAs(user, lead);
    });
    refused(Then);
  });

  Sc("Gestor de outra imobiliária não exporta", ({ When, Then }) => {
    When("{string} exporta os dados de {string}", async (_ctx, user: string, lead: string) => {
      await exportAs(user, lead);
    });
    refused(Then);
  });

  Sc("Gestora exclui os dados do lead", ({ When, Then, And }) => {
    When("{string} exclui os dados de {string}", async (_ctx, user: string, lead: string) => {
      await deleteAs(user, lead);
    });
    Then(
      "não sobra nada de {string}: lead, conversa, mensagens, histórico e consentimento",
      async (_ctx, lead: string) => {
        expect(dbError).toBeNull();
        const id = leadId(lead);
        const conv = s.conversations.get(lead) ?? "";
        expect(await count(s.conn`select count(*)::int as n from leads where id = ${id}`)).toBe(0);
        expect(
          await count(s.conn`select count(*)::int as n from conversations where id = ${conv} or lead_id = ${id}`),
        ).toBe(0);
        expect(await count(s.conn`select count(*)::int as n from messages where conversation_id = ${conv}`)).toBe(0);
        expect(await count(s.conn`select count(*)::int as n from lead_events where lead_id = ${id}`)).toBe(0);
        expect(await count(s.conn`select count(*)::int as n from consents where conversation_id = ${conv}`)).toBe(0);
      },
    );
    And("o resumo enviado a {string} também foi apagado", async (_ctx, agent: string) => {
      const rows = await s.conn<{ body: string | null }[]>`
        select body from messages where conversation_id = ${s.conversations.get(`agent:${agent}`) ?? ""}`;
      expect(rows.map((r) => r.body)).toEqual(["Bom dia, equipe!"]);
    });
    And(
      "fica um registro de exclusão da {string} feito por {string}, sem nome nem telefone",
      async (_ctx, org: string, user: string) => {
        const rows = await s.conn<Record<string, unknown>[]>`
          select * from lead_data_deletions where organization_id = ${s.orgId(org)}`;
        expect(rows).toHaveLength(1);
        expect(rows[0]?.["actor_id"]).toBe(userId(user));
        const text = JSON.stringify(rows[0]);
        expect(text).not.toContain("Ana Ribeiro");
        expect(text).not.toContain("5511987654321");
      },
    );
    And("o lead {string} e a conversa dele continuam", async (_ctx, lead: string) => {
      expect(await count(s.conn`select count(*)::int as n from leads where id = ${leadId(lead)}`)).toBe(1);
      expect(
        await count(s.conn`select count(*)::int as n from messages where conversation_id = ${s.conversations.get(lead) ?? ""}`),
      ).toBe(1);
    });
  });

  Sc("Corretora dona do lead não exclui", ({ When, Then, And }) => {
    When("{string} exclui os dados de {string}", async (_ctx, user: string, lead: string) => {
      await deleteAs(user, lead);
    });
    refused(Then);
    stillThere(And);
  });

  Sc("Gestor de outra imobiliária não exclui", ({ When, Then, And }) => {
    When("{string} exclui os dados de {string}", async (_ctx, user: string, lead: string) => {
      await deleteAs(user, lead);
    });
    refused(Then);
    stillThere(And);
  });

  Sc("Visitante anônimo não exporta nem exclui", ({ When, Then }) => {
    When(
      "um visitante anônimo tenta exportar e excluir os dados de {string}",
      async (_ctx, lead: string) => {
        anonErrors = [
          await s.expectError(() => s.as(null, (c) => c`select public.export_lead_data(${leadId(lead)})`)),
          await s.expectError(() => s.as(null, (c) => c`select public.delete_lead_data(${leadId(lead)})`)),
        ];
      },
    );
    Then("o acesso é negado nas duas", () => {
      for (const e of anonErrors) expect(e).toMatch(/permission denied|not allowed/);
    });
  });

  Sc("Registro de exclusão só para o gestor da própria imobiliária", ({ Given, Then, And }) => {
    Given("{string} excluiu os dados de {string}", async (_ctx, user: string, lead: string) => {
      await deleteAs(user, lead);
      expect(dbError).toBeNull();
    });
    const sees = async (user: string) =>
      count(s.as(user, (c) => c<{ n: number }[]>`select count(*)::int as n from lead_data_deletions`));
    Then("os registros de exclusão que cada um vê são:", async (_ctx, table: TableRow[]) => {
      for (const row of table) {
        expect({ pessoa: row["pessoa"], n: await sees(row["pessoa"] ?? "") }).toEqual({
          pessoa: row["pessoa"],
          n: Number(row["registros"]),
        });
      }
    });
    And("ninguém grava nem apaga registro de exclusão pelo app", async () => {
      const org = s.orgId("Horizonte");
      const attempts = [
        await s.expectError(() =>
          s.as("Paula", (c) => c`insert into lead_data_deletions (organization_id) values (${org})`),
        ),
        await s.expectError(() => s.as("Paula", (c) => c`delete from lead_data_deletions`)),
        await s.expectError(() => s.as("Paula", (c) => c`update lead_data_deletions set summary = '{}'`)),
      ];
      for (const e of attempts) expect(e).toMatch(/permission denied/);
    });
  });
});
