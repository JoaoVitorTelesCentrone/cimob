import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/importacao/pdf-incorporadora.feature", {
  language: "pt",
});

type TableRow = Record<string, string>;
const STATUS: Record<string, string> = {
  disponível: "available",
  reservado: "reserved",
  vendido: "sold",
};
const LABEL = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [v, k]));
/** "765.000" → 765000; vazio → null. */
const money = (text: string | undefined) =>
  text ? Number(text.replace(/\./g, "").replace(",", ".")) : null;

/** Linhas como o services/ingest devolve (a extração em si é testada no Python). */
const toRows = (table: TableRow[]) =>
  table.map((r) => ({
    code: r["código"],
    area_m2: money(r["área"]),
    price: money(r["preço"]),
    status: r["situação"] ? STATUS[r["situação"]] : null,
    needs_review: r["revisar"] === "sim",
    issues: r["revisar"] === "sim" ? ["revisar"] : [],
  }));

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let importId = "";
  let dbError: string | null = null;
  let errors: (string | null)[] = [];

  AfterEachScenario(async () => {
    await s.end();
  });

  const devId = () => s.devs.get("Residencial Aurora") ?? "";
  const createImport = (user: string, rows: TableRow[], file = "tabela.pdf") =>
    s.as(user, async (c) => {
      const [row] = await c<{ id: string }[]>`
        select public.create_unit_import(${devId()}, ${file}, ${c.json(toRows(rows))}, '[]'::jsonb) as id`;
      importId = row?.id ?? "";
    });
  const publish = (user: string) =>
    s.expectError(() => s.as(user, (c) => c`select public.publish_unit_import(${importId})`));
  const unit = async (code: string) => {
    const [row] = await s.conn<{ price: string | null; status: string }[]>`
      select price::text, status::text from units where development_id = ${devId()} and code = ${code}`;
    return row;
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com a gestora {string} e a corretora {string}",
      async (_ctx, org: string, admin: string, agent: string) => {
        s = await Scenario.begin();
        importId = "";
        dbError = null;
        errors = [];
        await s.org(org);
        await s.member(admin, org, "org_admin");
        await s.member(agent, org, "agent");
      },
    );
    And(
      "o empreendimento publicado {string} com as unidades:",
      async (_ctx, name: string, table: TableRow[]) => {
        await s.development("Horizonte", name, true);
        for (const r of table) {
          await s.conn`
            insert into units (organization_id, development_id, code, price, status)
            values (${s.orgId("Horizonte")}, ${devId()}, ${r["código"] ?? ""}, ${money(r["preço"])},
                    ${STATUS[r["situação"] ?? ""] ?? "available"}::unit_status)`;
        }
      },
    );
  });

  type Step<A extends unknown[]> = (text: string, fn: (ctx: unknown, ...a: A) => void | Promise<void>) => void;
  const draft = (Given: Step<[string, TableRow[]]>) => {
    Given("um rascunho do {string} com as linhas:", async (_ctx, _dev, table) => {
      await createImport("Paula", table);
    });
  };
  const publishes = (When: Step<[string]>) => {
    When("{string} publica a importação", async (_ctx, user) => {
      dbError = await publish(user);
      expect(dbError).toBeNull();
    });
  };
  const keepsPrice = (Step: Step<[string, string]>) => {
    Step("{string} continua com o preço {string}", async (_ctx, code, price) => {
      expect(Number((await unit(code))?.price)).toBe(money(price));
    });
  };
  const republishRefused = (And: Step<[]>) => {
    And("publicar de novo é recusado", async () => {
      expect(await publish("Paula")).not.toBeNull();
    });
  };

  Sc("PDF vira rascunho para revisão", ({ When, Then, And }) => {
    When(
      "{string} importa o PDF {string} do {string} com as linhas:",
      async (_ctx, user: string, file: string, _dev: string, table: TableRow[]) => {
        await createImport(user, table, file);
      },
    );
    Then("a importação fica em rascunho com {int} linhas", async (_ctx, n: number) => {
      const [imp] = await s.as(
        "Paula",
        (c) => c<{ status: string; file_name: string }[]>`
          select status, file_name from unit_imports where id = ${importId}`,
      );
      expect(imp).toEqual({ status: "draft", file_name: "tabela-aurora-nov.pdf" });
      const rows = await s.as("Paula", (c) => c`select code from unit_import_rows where import_id = ${importId}`);
      expect(rows).toHaveLength(n);
    });
    And(
      "o site continua com {string} a {string} e sem {string}",
      async (_ctx, code: string, price: string, missing: string) => {
        const seen = await s.as(
          null,
          (c) => c<{ code: string; price: string | null }[]>`
            select code, price::text from units where development_id = ${devId()} order by code`,
        );
        expect(seen.map((u) => u.code)).not.toContain(missing);
        expect(Number(seen.find((u) => u.code === code)?.price)).toBe(money(price));
      },
    );
  });

  Sc("Publicar atualiza e cria, sem apagar", ({ Given, When, Then, And }) => {
    draft(Given);
    publishes(When);
    Then("as unidades do {string} ficam:", async (_ctx, _dev: string, table: TableRow[]) => {
      const units = await s.conn<{ code: string; price: string; status: string }[]>`
        select code, price::text, status::text from units where development_id = ${devId()} order by code`;
      expect(units.map((u) => ({ código: u.code, preço: Number(u.price), situação: LABEL[u.status] }))).toEqual(
        table.map((r) => ({ código: r["código"], preço: money(r["preço"]), situação: r["situação"] })),
      );
    });
    And("a importação fica publicada", async () => {
      const [imp] = await s.conn<{ status: string; published_by: string | null }[]>`
        select status, published_by from unit_imports where id = ${importId}`;
      expect(imp).toEqual({ status: "published", published_by: s.users.get("Paula") });
    });
    republishRefused(And);
  });

  Sc("Linha ilegível não é inventada", ({ Given, When, Then, And }) => {
    draft(Given);
    publishes(When);
    Then("{string} fica com o preço em branco", async (_ctx, code: string) => {
      const u = await unit(code);
      expect(u).toBeDefined();
      expect(u?.price).toBeNull();
    });
    keepsPrice(And);
  });

  Sc("Unidade nova com situação ilegível não entra como disponível", ({ Given, When, Then }) => {
    draft(Given);
    publishes(When);
    Then("{string} fica {string}", async (_ctx, code: string, label: string) => {
      expect((await unit(code))?.status).toBe(STATUS[label]);
    });
  });

  Sc("Descartar o rascunho não muda nada", ({ Given, When, Then, And }) => {
    draft(Given);
    When("{string} descarta a importação", async (_ctx, user: string) => {
      await s.as(user, (c) => c`select public.discard_unit_import(${importId})`);
    });
    keepsPrice(Then);
    republishRefused(And);
  });

  Sc("Corretora não importa nem publica", ({ Given, When, Then, And }) => {
    draft(Given);
    When("{string} tenta importar e publicar", async (_ctx, user: string) => {
      errors = [
        await s.expectError(() => createImport(user, [{ "código": "AUR-9", "preço": "1" }])),
        await publish(user),
      ];
    });
    Then("o banco recusa as duas", () => {
      for (const e of errors) expect(e).not.toBeNull();
    });
    keepsPrice(And);
  });

  Sc("Gestor de outra imobiliária não vê nem publica o rascunho", ({ Given, When, Then, And }) => {
    draft(Given);
    And("a imobiliária {string} com o gestor {string}", async (_ctx, org: string, admin: string) => {
      await s.org(org);
      await s.member(admin, org, "org_admin");
    });
    let seen = -1;
    When("{string} tenta ver e publicar a importação", async (_ctx, user: string) => {
      seen = (await s.as(user, (c) => c`select id from unit_imports where id = ${importId}`)).length;
      dbError = await publish(user);
    });
    Then("ele não vê o rascunho e o banco recusa a publicação", () => {
      expect(seen).toBe(0);
      expect(dbError).not.toBeNull();
    });
  });
});
