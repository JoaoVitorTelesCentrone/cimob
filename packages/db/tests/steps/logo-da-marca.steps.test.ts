import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/logo-da-marca.feature", { language: "pt" });

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let dbError: string | null = null;

  AfterEachScenario(async () => {
    await s.end();
  });

  /** O Storage grava em storage.objects com o JWT de quem envia: é ali que as regras valem. */
  const put = async (user: string, folder: string, file: string) => {
    dbError = await s.expectError(() =>
      s.as(
        user,
        (c) => c`insert into storage.objects (bucket_id, name, owner_id) values ('brand', ${`${folder}/${file}`}, ${s.users.get(user) ?? null})`,
      ),
    );
  };

  Background(({ Given, And }) => {
    Given("as imobiliárias {string} e {string}", async (_ctx, a: string, b: string) => {
      s = await Scenario.begin();
      dbError = null;
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
  });

  type When = (t: string, f: (c: unknown, u: string, f: string, o: string) => Promise<void>) => void;
  const putIn = (When: When) => {
    When("{string} grava o arquivo {string} na pasta da {string}", async (_ctx, user, file, org) => {
      await put(user, s.orgId(org), file);
    });
  };
  const refused = (Then: (t: string, f: () => void) => void) => {
    Then("o Storage recusa", () => {
      expect(dbError).toMatch(/row-level security|permission denied/);
    });
  };

  Sc("Gestora grava o logo na pasta da própria imobiliária", ({ When, Then }) => {
    putIn(When);
    Then("o arquivo fica gravado", () => {
      expect(dbError).toBeNull();
    });
  });

  Sc("Gestora não grava na pasta de outra imobiliária", ({ When, Then }) => {
    putIn(When);
    refused(Then);
  });

  Sc("Corretora não grava o logo", ({ When, Then }) => {
    putIn(When);
    refused(Then);
  });

  Sc("Pasta que não é de imobiliária é recusada", ({ When, Then }) => {
    When("{string} grava o arquivo {string} na pasta {string}", async (_ctx, user: string, file: string, folder: string) => {
      await put(user, folder, file);
    });
    refused(Then);
  });
});
