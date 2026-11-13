import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import type { UnitStatus } from "@/lib/inventory";
import { buildSite, type Site, type SiteBrand, type SiteDevelopment } from "@/lib/site/model";

const feature = await loadFeature("../../features/site/site-publico.feature", { language: "pt" });

type TableRow = Record<string, string>;

describeFeature(feature, ({ Background, Scenario }) => {
  let brand: SiteBrand;
  let development: SiteDevelopment;
  let developments: SiteDevelopment[] = [];
  let site: Site;

  /** Todo o texto que o visitante vê no destaque. */
  const featuredTexts = () => {
    const f = site.featured;
    return f
      ? [f.name, f.summary, f.availability, f.fromPrice, f.plans].filter(Boolean)
      : [site.empty ?? ""];
  };
  const decode = (url: string | null) => {
    if (!url) return null;
    const u = new URL(url);
    return { phone: u.pathname.slice(1), text: u.searchParams.get("text") };
  };

  Background(({ Given, And }) => {
    Given(
      "a imobiliária {string} com CRECI {string} e WhatsApp {string}",
      (_ctx, name: string, creci: string, whatsapp: string) => {
        brand = { name, creci, whatsapp };
      },
    );
    And(
      "o empreendimento publicado {string} em {string} com entrega em {string}",
      (_ctx, name: string, address: string, delivery: string) => {
        development = {
          id: "dev-1",
          name,
          address,
          deliveryDate: delivery,
          isDemo: false,
          units: [],
        };
        developments = [development];
      },
    );
    And("as unidades:", (_ctx, table: TableRow[]) => {
      development.units = table.map((r) => ({
        code: r["código"] ?? "",
        bedrooms: Number(r["quartos"]),
        areaM2: Number(r["área"]),
        price: r["preço"] ? Number(r["preço"]) : null,
        status: (r["status"] ?? "available") as UnitStatus,
      }));
    });
  });

  const open = (When: (t: string, f: () => void) => void) => {
    When("o visitante abre o site", () => {
      site = buildSite(brand, developments);
    });
  };
  const shows = (Step: (t: string, f: (c: unknown, text: string) => void) => void) => {
    Step("aparece {string}", (_ctx, text: string) => {
      expect(featuredTexts()).toContain(text);
    });
  };

  Scenario("O destaque mostra o empreendimento com os números da ficha", ({ When, Then, And }) => {
    open(When);
    Then("o destaque é {string}", (_ctx, name: string) => {
      expect(site.featured?.name).toBe(name);
    });
    And("o resumo é {string}", (_ctx, summary: string) => {
      expect(site.featured?.summary).toBe(summary);
    });
    And("aparecem {string} e {string}", (_ctx, a: string, b: string) => {
      expect(featuredTexts()).toEqual(expect.arrayContaining([a, b]));
    });
    And("as plantas são {string}", (_ctx, plans: string) => {
      expect(site.featured?.plans).toBe(plans);
    });
  });

  Scenario(
    'Preço de unidade reservada ou vendida não entra no "a partir de"',
    ({ Given, When, Then }) => {
      Given("as unidades disponíveis estão sem preço na ficha", () => {
        development.units = development.units.map((u) =>
          u.status === "available" ? { ...u, price: null } : u,
        );
      });
      open(When);
      Then("não aparece {string}", (_ctx, text: string) => {
        expect(featuredTexts().join(" ")).not.toContain(text);
      });
    },
  );

  Scenario("Sem unidade disponível, o site diz isso", ({ Given, When, Then }) => {
    Given("todas as unidades estão vendidas", () => {
      development.units = development.units.map((u) => ({ ...u, status: "sold" as const }));
    });
    open(When);
    shows(Then);
  });

  Scenario(
    "O WhatsApp abre a conversa com a imobiliária já falando do empreendimento",
    ({ When, Then, And }) => {
      open(When);
      Then(
        "o botão do WhatsApp aponta para {string} com o texto {string}",
        (_ctx, phone: string, text: string) => {
          expect(decode(site.featured?.whatsappUrl ?? null)).toEqual({ phone, text });
        },
      );
      And(
        "o botão de visita aponta para {string} com o texto {string}",
        (_ctx, phone: string, text: string) => {
          expect(decode(site.featured?.visitUrl ?? null)).toEqual({ phone, text });
        },
      );
    },
  );

  Scenario("Sem WhatsApp cadastrado, não há botão de WhatsApp", ({ Given, When, Then }) => {
    Given("a imobiliária está sem WhatsApp cadastrado", () => {
      brand = { ...brand, whatsapp: null };
    });
    open(When);
    Then("não aparece botão de WhatsApp", () => {
      expect(site.whatsappUrl).toBeNull();
      expect(site.featured?.whatsappUrl).toBeNull();
      expect(site.featured?.visitUrl).toBeNull();
    });
  });

  Scenario("O rodapé traz o CRECI e a assinatura da Center One", ({ When, Then, And }) => {
    open(When);
    Then("o rodapé mostra {string}", (_ctx, text: string) => {
      expect(site.footer).toContain(text);
    });
    And("o rodapé mostra {string}", (_ctx, text: string) => {
      expect(site.footer).toContain(text);
    });
  });

  Scenario("Dados de demonstração aparecem marcados", ({ Given, When, Then }) => {
    Given("o empreendimento é de demonstração", () => {
      development.isDemo = true;
    });
    open(When);
    Then("aparece o aviso {string}", (_ctx, text: string) => {
      expect(site.demoNotice).toBe(text);
    });
  });

  Scenario("Imobiliária sem empreendimento publicado", ({ Given, When, Then }) => {
    Given("nenhum empreendimento está publicado", () => {
      developments = [];
    });
    open(When);
    shows(Then);
  });
});
