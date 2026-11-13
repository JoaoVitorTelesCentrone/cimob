import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/dados-do-bot-rls.feature", {
  language: "pt",
});

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let seen: string[] = [];
  let dbError: string | null = null;
  let anonErrors: (string | null)[] = [];

  AfterEachScenario(async () => {
    await s.end();
  });

  const listAs = async (user: string) => {
    const rows = await s.as(
      user,
      (c) => c<{ body: string }[]>`
        select m.body from conversations c join messages m on m.conversation_id = c.id
        union all select '#conversa' from conversations
        union all select m.body from messages m`,
    );
    seen = rows.map((r) => r.body);
  };
  const tryAsSystem = async (fn: () => Promise<unknown>) => {
    dbError = await s.expectError(fn);
  };
  const conversationOf = (lead: string) => s.conversations.get(lead) ?? "";

  Background(({ Given, And }) => {
    Given("as imobiliárias {string} e {string}", async (_ctx, a: string, b: string) => {
      s = await Scenario.begin();
      seen = [];
      dbError = null;
      anonErrors = [];
      await s.org(a);
      await s.org(b);
    });
    And(
      "a {string} com a gestora {string} e os corretores {string} e {string}",
      async (_ctx, org: string, admin: string, a: string, b: string) => {
        await s.member(admin, org, "org_admin");
        await s.member(a, org, "agent");
        await s.member(b, org, "agent");
      },
    );
    And("a {string} com o gestor {string}", async (_ctx, org: string, admin: string) => {
      await s.member(admin, org, "org_admin");
    });
    And(
      "o lead {string} de {string} na {string} com a conversa {string}",
      async (_ctx, lead: string, owner: string, org: string, message: string) => {
        await s.lead(org, lead, undefined, owner);
        await s.conversation(org, lead, { lead, message, waMessageId: `wamid.${lead}` });
      },
    );
  });

  const listSteps = (When: (t: string, f: (ctx: unknown, u: string) => Promise<void>) => void) => {
    When("{string} lista as conversas e as mensagens", async (_ctx, user: string) => {
      await listAs(user);
    });
  };

  Sc("Gestora lê as conversas e mensagens da própria imobiliária", ({ When, Then }) => {
    listSteps(When);
    Then("aparece a mensagem {string}", (_ctx, body: string) => {
      expect(seen).toContain(body);
      expect(seen).toContain("#conversa");
    });
  });

  Sc("Corretora dona do lead lê a conversa", ({ When, Then }) => {
    listSteps(When);
    Then("aparece a mensagem {string}", (_ctx, body: string) => {
      expect(seen).toContain(body);
    });
  });

  Sc("Outro corretor não lê a conversa", ({ When, Then }) => {
    listSteps(When);
    Then("nenhuma conversa nem mensagem aparece", () => {
      expect(seen).toEqual([]);
    });
  });

  const noLeadGiven = (
    Given: (t: string, f: (ctx: unknown, org: string, m: string) => Promise<void>) => void,
  ) => {
    Given(
      "uma conversa sem lead na {string} com a mensagem {string}",
      async (_ctx, org: string, message: string) => {
        await s.conversation(org, "sem-lead", { message });
      },
    );
  };

  Sc("Conversa ainda sem lead não aparece para o corretor", ({ Given, When, Then }) => {
    noLeadGiven(Given);
    listSteps(When);
    Then("nenhuma conversa nem mensagem aparece", () => {
      expect(seen).toEqual([]);
    });
  });

  Sc("Conversa ainda sem lead aparece para o gestor", ({ Given, When, Then }) => {
    noLeadGiven(Given);
    listSteps(When);
    Then("aparece a mensagem {string}", (_ctx, body: string) => {
      expect(seen).toContain(body);
    });
  });

  Sc("Gestor de outra imobiliária não lê nada", ({ When, Then }) => {
    listSteps(When);
    Then("nenhuma conversa nem mensagem aparece", () => {
      expect(seen).toEqual([]);
    });
  });

  Sc("Visitante anônimo não acessa dados do bot", ({ When, Then }) => {
    When(
      "um visitante anônimo consulta conversas, mensagens, consentimentos e números",
      async () => {
        for (const table of ["conversations", "messages", "consents", "whatsapp_accounts"]) {
          anonErrors.push(
            await s.expectError(() => s.as(null, (c) => c.unsafe(`select 1 from ${table}`))),
          );
        }
      },
    );
    Then("o acesso é negado em todas", () => {
      expect(anonErrors).toHaveLength(4);
      for (const e of anonErrors) expect(e).toMatch(/permission denied/);
    });
  });

  Sc("Ninguém grava mensagem pelo app", ({ When, Then }) => {
    When(
      "{string} tenta gravar uma mensagem na conversa de {string}",
      async (_ctx, user: string, lead: string) => {
        dbError = await s.expectError(() =>
          s.as(
            user,
            (c) => c`insert into messages (organization_id, conversation_id, direction, type, body)
                     values (${s.orgId("Horizonte")}, ${conversationOf(lead)}, 'outbound', 'text', 'oi')`,
          ),
        );
      },
    );
    Then("o banco recusa", () => {
      expect(dbError).toMatch(/permission denied/);
    });
  });

  const listNumbers = async (user: string) => {
    const rows = await s.as(
      user,
      (c) => c<{ phone_number_id: string }[]>`select phone_number_id from whatsapp_accounts`,
    );
    seen = rows.map((r) => r.phone_number_id);
  };
  const numberGiven = (
    Given: (t: string, f: (ctx: unknown, org: string, p: string) => Promise<void>) => void,
  ) => {
    Given(
      "a {string} com o número do WhatsApp {string}",
      async (_ctx, org: string, phone: string) => {
        await s.whatsappAccount(org, phone);
      },
    );
  };
  const numberWhen = (When: (t: string, f: (ctx: unknown, u: string) => Promise<void>) => void) => {
    When("{string} lista os números de WhatsApp", async (_ctx, user: string) => {
      await listNumbers(user);
    });
  };

  Sc("Corretor não vê o número de WhatsApp da imobiliária", ({ Given, When, Then }) => {
    numberGiven(Given);
    numberWhen(When);
    Then("nenhum número aparece", () => {
      expect(seen).toEqual([]);
    });
  });

  Sc("Gestora vê o número de WhatsApp da imobiliária", ({ Given, When, Then }) => {
    numberGiven(Given);
    numberWhen(When);
    Then("aparece o número {string}", (_ctx, phone: string) => {
      expect(seen).toEqual([phone]);
    });
  });

  Sc("O mesmo número não pode estar em duas imobiliárias", ({ Given, When, Then }) => {
    Given(
      "a {string} com o número do WhatsApp {string}",
      async (_ctx, org: string, phone: string) => {
        await s.whatsappAccount(org, phone);
      },
    );
    When(
      "o sistema cadastra o número {string} na {string}",
      async (_ctx, phone: string, org: string) => {
        await tryAsSystem(() => s.whatsappAccount(org, phone));
      },
    );
    Then("o banco recusa", () => {
      expect(dbError).toMatch(/whatsapp_accounts_phone_number_id_unique/);
    });
  });

  Sc("A mesma mensagem do WhatsApp não é gravada duas vezes", ({ When, Then }) => {
    When(
      "o sistema grava de novo a mensagem da conversa de {string} com o mesmo id do WhatsApp",
      async (_ctx, lead: string) => {
        await tryAsSystem(
          () => s.conn`
            insert into messages (organization_id, conversation_id, wa_message_id, direction, type, body)
            values (${s.orgId("Horizonte")}, ${conversationOf(lead)}, ${`wamid.${lead}`}, 'inbound', 'text', 'de novo')`,
        );
      },
    );
    Then("o banco recusa", () => {
      expect(dbError).toMatch(/messages_wa_message_id_unique/);
    });
  });

  Sc("Conversa não pode apontar para lead de outra imobiliária", ({ Given, When, Then }) => {
    Given("o lead {string} na {string}", async (_ctx, lead: string, org: string) => {
      await s.lead(org, lead);
    });
    When(
      "o sistema liga a conversa de {string} ao lead {string}",
      async (_ctx, lead: string, other: string) => {
        await tryAsSystem(
          () =>
            s.conn`update conversations set lead_id = ${s.leads.get(other) ?? ""} where id = ${conversationOf(lead)}`,
        );
      },
    );
    Then("o banco recusa", () => {
      expect(dbError).toMatch(/conversations_lead_fk/);
    });
  });

  const consentGiven = (
    Given: (t: string, f: (ctx: unknown, l: string, t2: string) => Promise<void>) => void,
  ) => {
    Given(
      "{string} aceitou o aviso de privacidade {string}",
      async (_ctx, lead: string, text: string) => {
        await s.conn`
          insert into consents (organization_id, conversation_id, scope, text_shown)
          values (${s.orgId("Horizonte")}, ${conversationOf(lead)}, 'privacy_notice', ${text})`;
      },
    );
  };
  const consentWhen = (
    When: (t: string, f: (ctx: unknown, u: string) => Promise<void>) => void,
  ) => {
    When("{string} lista os consentimentos", async (_ctx, user: string) => {
      const rows = await s.as(
        user,
        (c) => c<{ text_shown: string }[]>`select text_shown from consents`,
      );
      seen = rows.map((r) => r.text_shown);
    });
  };

  Sc("Consentimento não aparece para quem não vê o lead", ({ Given, When, Then }) => {
    consentGiven(Given);
    consentWhen(When);
    Then("nenhum consentimento aparece", () => {
      expect(seen).toEqual([]);
    });
  });

  Sc("Consentimento aparece para a corretora dona do lead", ({ Given, When, Then }) => {
    consentGiven(Given);
    consentWhen(When);
    Then("aparece o consentimento {string}", (_ctx, text: string) => {
      expect(seen).toEqual([text]);
    });
  });
});
