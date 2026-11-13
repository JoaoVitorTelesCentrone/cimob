import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { importAdSpend, type ImportLog } from "../../src/ads/import.ts";
import type { DailyInsight } from "../../src/ads/marketing-api.ts";
import { Chat } from "../support/chat.ts";
import { BotTestDb } from "../support/db.ts";
import { FakeMarketing, MARKETING_ERRORS } from "../support/fake-marketing.ts";
import { adTextMessage } from "../support/payloads.ts";

const feature = await loadFeature("../../features/bot/gasto-meta.feature", { language: "pt" });

const TOKEN = "EAAG-token-marketing-da-horizonte";
const FALLBACK_TOKEN = "EAAG-token-marketing-do-ambiente";

type TableRow = Record<string, string>;
const money = (text: string) => Number(text.replace(/\./g, "").replace(",", "."));
const toInsight = (row: TableRow): DailyInsight => ({
  date: row["data"] ?? "",
  adId: row["anúncio"] ?? "",
  campaignId: row["campanha"] || null,
  spend: money(row["gasto"] ?? "0"),
  impressions: Number(row["impressões"] ?? 0),
  clicks: Number(row["cliques"] ?? 0),
});

describeFeature(feature, ({ Background, Scenario, AfterEachScenario }) => {
  let db: BotTestDb;
  let chat: Chat;
  let marketing: FakeMarketing;
  let alerts: string[] = [];
  let logs: ImportLog[] = [];

  AfterEachScenario(async () => {
    await db.cleanup();
  });

  const runImport = () =>
    importAdSpend({
      sql: db.sql,
      api: marketing,
      fallbackToken: FALLBACK_TOKEN,
      today: new Date("2026-11-12T15:00:00-03:00"),
      alert: (text) => {
        alerts.push(text);
        return Promise.resolve();
      },
      log: (entry) => logs.push(entry),
    });

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com a conta de anúncios {string} e o token guardado no cofre",
      async (_ctx, org: string, act: string) => {
        db = new BotTestDb();
        marketing = new FakeMarketing();
        alerts = [];
        logs = [];
        await db.org(org, "PHONE_ADS");
        await db.metaAdsAccount(org, act);
        await db.vaultAdsToken(org, TOKEN);
        await db.agent(org, "Marina");
        await db.unit(org, "AUR-502", 765_000, "available");
        chat = new Chat(db, org, "PHONE_ADS");
      },
    );
    And(
      "a imobiliária {string} com a conta de anúncios {string} e sem token próprio",
      async (_ctx, org: string, act: string) => {
        await db.org(org, `PHONE_${org.toUpperCase()}`);
        await db.metaAdsAccount(org, act);
      },
    );
    And("a imobiliária {string} sem conta de anúncios", async (_ctx, org: string) => {
      await db.org(org, `PHONE_${org.toUpperCase()}`);
    });
  });

  const metaResponde = (Given: (t: string, f: (ctx: unknown, a: string, t2: TableRow[]) => void) => void) => {
    Given("a Meta responde o gasto de {string}:", (_ctx, act: string, table: TableRow[]) => {
      marketing.setInsights(act, table.map(toInsight));
    });
  };
  const importa = (When: (t: string, f: () => Promise<void>) => void) => {
    When("a importação de gasto roda", runImport);
  };

  Scenario("Importar o gasto recente por anúncio", ({ Given, When, Then, And }) => {
    metaResponde(Given);
    importa(When);
    Then("o gasto diário da {string} é:", async (_ctx, org: string, table: TableRow[]) => {
      const rows = await db.adSpend(org);
      expect(rows).toEqual(
        table.map((r) => ({
          date: r["data"],
          ad_id: r["anúncio"],
          campaign_id: r["campanha"],
          spend: money(r["gasto"] ?? "0").toFixed(2),
          impressions: Number(r["impressões"]),
          clicks: Number(r["cliques"]),
        })),
      );
    });
    And("a {string} não gerou chamada à Meta", async (_ctx, org: string) => {
      const accounts = await db.adsAccounts();
      const theirs = accounts.filter((a) => a.organization_id === db.orgId(org));
      const others = accounts.filter((a) => a.organization_id !== db.orgId(org));
      expect(theirs).toHaveLength(0);
      // Uma chamada por conta das outras imobiliárias, e nenhuma além delas.
      expect(marketing.calls.map((c) => c.adAccountId).sort()).toEqual(
        others.map((a) => a.ad_account_id).sort(),
      );
    });
  });

  Scenario(
    "A importação usa o token da imobiliária, e o token não aparece em logs nem alertas",
    ({ Given, When, Then, And }) => {
      metaResponde(Given);
      importa(When);
      Then(
        "a Meta recebeu a chamada de {string} com o token da {string}",
        async (_ctx, act: string, org: string) => {
          const call = marketing.calls.find((c) => c.adAccountId === act);
          expect(call?.token).toBe(TOKEN);
          const [account] = (await db.adsAccounts()).filter((a) => a.ad_account_id === act);
          expect(account?.organization_id).toBe(db.orgId(org));
        },
      );
      And("o token não aparece em nenhum log nem alerta", () => {
        expect(JSON.stringify([logs, alerts])).not.toContain(TOKEN);
      });
    },
  );

  Scenario("Conta sem token próprio usa o token do ambiente", ({ Given, When, Then, And }) => {
    metaResponde(Given);
    importa(When);
    Then("a Meta recebeu a chamada de {string} com o token do ambiente", (_ctx, act: string) => {
      const call = marketing.calls.find((c) => c.adAccountId === act);
      expect(call?.token).toBe(FALLBACK_TOKEN);
    });
    And("o gasto diário da {string} tem {int} linha", async (_ctx, org: string, n: number) => {
      expect(await db.adSpend(org)).toHaveLength(n);
    });
  });

  Scenario("Reimportar o mesmo período corrige os valores sem duplicar", ({ Given, When, Then, And }) => {
    metaResponde(Given);
    importa(When);
    And(
      "a Meta passa a responder o gasto de {string}:",
      (_ctx, act: string, table: TableRow[]) => {
        marketing.setInsights(act, table.map(toInsight));
      },
    );
    And("a importação de gasto roda de novo", runImport);
    Then("o gasto diário da {string} é:", async (_ctx, org: string, table: TableRow[]) => {
      const rows = await db.adSpend(org);
      expect(rows).toEqual(
        table.map((r) => ({
          date: r["data"],
          ad_id: r["anúncio"],
          campaign_id: r["campanha"],
          spend: money(r["gasto"] ?? "0").toFixed(2),
          impressions: Number(r["impressões"]),
          clicks: Number(r["cliques"]),
        })),
      );
    });
  });

  Scenario("Erro da Meta não derruba a importação nem grava nada", ({ Given, When, Then, And }) => {
    Given("a Meta responde {string} para {string}", (_ctx, error: string, act: string) => {
      marketing.scriptError(act, MARKETING_ERRORS[error as keyof typeof MARKETING_ERRORS]);
    });
    importa(When);
    Then("nenhum gasto é gravado", async () => {
      expect(await db.adSpendCount()).toBe(0);
    });
    And("a operação recebe um alerta de falha de importação", () => {
      expect(alerts.join("\n")).toMatch(/Falha na importação/);
    });
  });

  Scenario("Lead que chega por um anúncio nasce com origem e anúncio", ({ When, Then }) => {
    When(
      "o contato {string} manda {string} pelo anúncio {string} da {string}",
      async (_ctx, from: string, text: string, ad: string, org: string) => {
        await chat.deliver(adTextMessage(db.wamid(randomUUID()), from, await db.phoneOf(org), text, ad));
      },
    );
    Then(
      "o lead de {string} nasce com a origem {string} e o anúncio {string}",
      async (_ctx, from: string, source: string, ad: string) => {
        const lead = await db.leadByPhone("Horizonte", from);
        expect(lead?.source).toBe(source);
        expect(lead?.ad_id).toBe(ad);
      },
    );
  });

  Scenario(
    "Lead que volta por outro anúncio passa a apontar para o último anúncio clicado",
    ({ Given, When, Then }) => {
      Given(
        "o contato {string} já é lead da {string} vindo do anúncio {string}",
        async (_ctx, from: string, org: string, ad: string) => {
          await chat.deliver(
            adTextMessage(db.wamid(randomUUID()), from, await db.phoneOf(org), "Olá!", ad),
          );
          const lead = await db.leadByPhone(org, from);
          expect(lead?.ad_id).toBe(ad);
        },
      );
      When(
        "o contato {string} manda {string} pelo anúncio {string} da {string}",
        async (_ctx, from: string, text: string, ad: string, org: string) => {
          await chat.deliver(
            adTextMessage(db.wamid(randomUUID()), from, await db.phoneOf(org), text, ad),
          );
        },
      );
      Then(
        "o lead de {string} fica com a origem {string} e o anúncio {string}",
        async (_ctx, from: string, source: string, ad: string) => {
          const lead = await db.leadByPhone("Horizonte", from);
          expect(lead?.source).toBe(source);
          expect(lead?.ad_id).toBe(ad);
        },
      );
    },
  );

  Scenario("Mensagem sem anúncio mantém a origem do WhatsApp", ({ When, Then }) => {
    When(
      "o contato {string} manda {string} para a {string}",
      async (_ctx, from: string, text: string, org: string) => {
        expect(org).toBe("Horizonte"); // o Chat do cenário fala com o número da Horizonte
        await chat.type(from, text);
      },
    );
    Then(
      "o lead de {string} nasce com a origem {string} e sem anúncio",
      async (_ctx, from: string, source: string) => {
        const lead = await db.leadByPhone("Horizonte", from);
        expect(lead?.source).toBe(source);
        expect(lead?.ad_id).toBeNull();
      },
    );
  });
});
