import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/crm/tempo-real.feature", { language: "pt" });

describeFeature(feature, ({ Scenario: Sc }) => {
  const published = async () => {
    const s = await Scenario.begin();
    try {
      const rows = await s.conn<{ tablename: string }[]>`
        select tablename from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'`;
      return rows.map((r) => r.tablename);
    } finally {
      await s.end();
    }
  };

  Sc("Leads e estoque são publicados em tempo real", ({ Then }) => {
    Then(
      "o banco publica em tempo real {string}, {string}, {string} e {string}",
      async (_ctx, a: string, b: string, c: string, d: string) => {
        expect(await published()).toEqual(expect.arrayContaining([a, b, c, d]));
      },
    );
  });

  Sc("Equipe e organização não são publicadas", ({ Then }) => {
    Then(
      "o banco não publica em tempo real {string} nem {string}",
      async (_ctx, a: string, b: string) => {
        const tables = await published();
        expect(tables).not.toContain(a);
        expect(tables).not.toContain(b);
      },
    );
  });
});
