import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/gasto-meta-rls.feature", {
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
      "a {string} com a gestora {string} e a corretora {string}",
      async (_ctx, org: string, admin: string, agent: string) => {
        await s.member(admin, org, "org_admin");
        await s.member(agent, org, "agent");
      },
    );
    And("a {string} com o gestor {string}", async (_ctx, org: string, admin: string) => {
      await s.member(admin, org, "org_admin");
    });
    And("a {string} com a conta de anúncios {string}", async (_ctx, org: string, act: string) => {
      await s.conn`
        insert into meta_ads_accounts (organization_id, ad_account_id)
        values (${s.orgId(org)}, ${act})`;
    });
    And(
      "a {string} com gasto de {string} em {string} no anúncio {string}",
      async (_ctx, org: string, spend: string, date: string, ad: string) => {
        await s.conn`
          insert into ad_spend_daily (organization_id, date, ad_id, campaign_id, spend, impressions, clicks)
          values (${s.orgId(org)}, ${date}, ${ad}, 'camp_9', ${Number(spend.replace(",", "."))}, 4000, 55)`;
      },
    );
  });

  const listSpend = async (user: string) => {
    const rows = await s.as(
      user,
      (c) => c<{ ad_id: string; spend: string }[]>`select ad_id, spend::text from ad_spend_daily`,
    );
    seen = rows.map((r) => `${r.spend.replace(".", ",")} do anúncio ${r.ad_id}`);
  };
  const listSpendSteps = (When: (t: string, f: (ctx: unknown, u: string) => Promise<void>) => void) => {
    When("{string} lista o gasto diário", async (_ctx, user: string) => {
      await listSpend(user);
    });
  };

  Sc("Gestora lê o gasto da própria imobiliária", ({ When, Then }) => {
    listSpendSteps(When);
    Then("aparece o gasto de {string} do anúncio {string}", (_ctx, spend: string, ad: string) => {
      expect(seen).toEqual([`${spend} do anúncio ${ad}`]);
    });
  });

  Sc("Corretora não lê o gasto", ({ When, Then }) => {
    listSpendSteps(When);
    Then("nenhum gasto aparece", () => {
      expect(seen).toEqual([]);
    });
  });

  Sc("Gestor de outra imobiliária não lê o gasto", ({ When, Then }) => {
    listSpendSteps(When);
    Then("nenhum gasto aparece", () => {
      expect(seen).toEqual([]);
    });
  });

  const listAccounts = async (user: string) => {
    const rows = await s.as(
      user,
      (c) => c<{ ad_account_id: string }[]>`select ad_account_id from meta_ads_accounts`,
    );
    seen = rows.map((r) => r.ad_account_id);
  };
  const listAccountSteps = (When: (t: string, f: (ctx: unknown, u: string) => Promise<void>) => void) => {
    When("{string} lista as contas de anúncios", async (_ctx, user: string) => {
      await listAccounts(user);
    });
  };

  Sc("Gestora vê a conta de anúncios da própria imobiliária", ({ When, Then }) => {
    listAccountSteps(When);
    Then("aparece a conta {string}", (_ctx, act: string) => {
      expect(seen).toEqual([act]);
    });
  });

  Sc("Corretora não vê a conta de anúncios", ({ When, Then }) => {
    listAccountSteps(When);
    Then("nenhuma conta aparece", () => {
      expect(seen).toEqual([]);
    });
  });

  Sc("Visitante anônimo não acessa gasto nem contas de anúncios", ({ When, Then }) => {
    When(
      "um visitante anônimo consulta gasto diário e contas de anúncios",
      async () => {
        for (const table of ["ad_spend_daily", "meta_ads_accounts"]) {
          anonErrors.push(
            await s.expectError(() => s.as(null, (c) => c.unsafe(`select 1 from ${table}`))),
          );
        }
      },
    );
    Then("o acesso é negado nas duas", () => {
      expect(anonErrors).toHaveLength(2);
      for (const e of anonErrors) expect(e).toMatch(/permission denied/);
    });
  });

  Sc("Ninguém grava gasto pelo app", ({ When, Then }) => {
    When("{string} tenta gravar um gasto na {string}", async (_ctx, user: string, org: string) => {
      dbError = await s.expectError(() =>
        s.as(
          user,
          (c) => c`insert into ad_spend_daily (organization_id, date, ad_id, spend)
                   values (${s.orgId(org)}, '2026-11-12', 'ad_9', 10)`,
        ),
      );
    });
    Then("o banco recusa", () => {
      expect(dbError).toMatch(/row-level security|permission denied/);
    });
  });

  Sc("A mesma conta de anúncios não pode estar em duas imobiliárias", ({ When, Then }) => {
    When("o sistema cadastra a conta {string} na {string}", async (_ctx, act: string, org: string) => {
      dbError = await s.expectError(
        () => s.conn`
          insert into meta_ads_accounts (organization_id, ad_account_id)
          values (${s.orgId(org)}, ${act})`,
      );
    });
    Then("o banco recusa", () => {
      expect(dbError).toMatch(/meta_ads_accounts_ad_account_id_unique/);
    });
  });
});
