import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/seguranca/unidade-colunas.feature", { language: "pt" });

describeFeature(feature, ({ Background, Scenario: Sc, AfterEachScenario }) => {
  let s: Scenario;
  let errors: (string | null)[] = [];

  AfterEachScenario(async () => {
    await s.end();
  });

  const unitId = () => s.units.get("AUR-502") ?? "";
  const edit = (user: string, price: string, area: string, floor: string) =>
    s.expectError(() =>
      s.as(
        user,
        (c) => c`update units set price = ${Number(price)}, area_m2 = ${Number(area)}, floor = ${Number(floor)}
                 where id = ${unitId()}`,
      ),
    );
  const changes = (When: (t: string, f: (c: unknown, u: string, p: string, a: string, fl: string) => Promise<void>) => void) => {
    When(
      "{string} muda o preço para {string}, a área para {string} e o andar para {string}",
      async (_ctx, user, price, area, floor) => {
        await edit(user, price, area, floor);
      },
    );
  };
  const isNow = (Then: (t: string, f: (c: unknown, code: string, p: string, a: string, fl: string) => Promise<void>) => void) => {
    Then(
      "a unidade {string} fica com preço {string}, área {string} e andar {string}",
      async (_ctx, _code, price, area, floor) => {
        const [u] = await s.conn<{ price: string | null; area_m2: string | null; floor: number | null }[]>`
          select price::text, area_m2::text, floor from units where id = ${unitId()}`;
        expect({ price: Number(u?.price), area: u?.area_m2 === null ? "" : Number(u?.area_m2), floor: u?.floor ?? "" }).toEqual({
          price: Number(price),
          area: area === "" ? "" : Number(area),
          floor: floor === "" ? "" : Number(floor),
        });
      },
    );
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com a gestora {string} e a corretora {string}",
      async (_ctx, org: string, admin: string, agent: string) => {
        s = await Scenario.begin();
        errors = [];
        await s.org(org);
        await s.member(admin, org, "org_admin");
        await s.member(agent, org, "agent");
      },
    );
    And(
      "a unidade {string} do empreendimento {string} com preço {string}",
      async (_ctx, code: string, dev: string, price: string) => {
        await s.development("Horizonte", dev, true);
        await s.unit("Horizonte", dev, code);
        await s.conn`update units set price = ${Number(price)} where code = ${code} and organization_id = ${s.orgId("Horizonte")}`;
      },
    );
  });

  Sc("Gestora edita a ficha da unidade", ({ When, Then }) => {
    changes(When);
    isNow(Then);
  });

  Sc("Gestora não muda código, empreendimento nem imobiliária da unidade", ({ When, Then }) => {
    When("{string} tenta mudar o código, o empreendimento e a imobiliária da unidade", async (_ctx, user: string) => {
      const other = await s.development("Horizonte", "Outro", true);
      errors = [
        await s.expectError(() => s.as(user, (c) => c`update units set code = 'AUR-999' where id = ${unitId()}`)),
        await s.expectError(() => s.as(user, (c) => c`update units set development_id = ${other} where id = ${unitId()}`)),
        await s.expectError(() =>
          s.as(user, (c) => c`update units set organization_id = ${s.orgId("Horizonte")} where id = ${unitId()}`),
        ),
      ];
    });
    Then("o banco recusa nas três", () => {
      for (const e of errors) expect(e).toMatch(/permission denied/);
    });
  });

  Sc("Corretora não edita a unidade", ({ When, Then }) => {
    changes(When);
    isNow(Then);
  });
});
