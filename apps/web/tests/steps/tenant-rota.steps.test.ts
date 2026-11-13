import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { cachedResolver } from "@/lib/tenant/cache";
import {
  decideRoute,
  sanitizeHeaders,
  type Resolver,
  type RouteDecision,
  type Tenant,
} from "@/lib/tenant/route";

const feature = await loadFeature("../../features/site/tenant-rota.feature", { language: "pt" });

const HORIZONTE: Tenant = { id: "org-horizonte", slug: "horizonte" };

describeFeature(feature, ({ Scenario, ScenarioOutline, BeforeEachScenario }) => {
  let bySlug: Record<string, Tenant>;
  let byDomain: Record<string, Tenant>;
  let lookups: string[];
  let decision: RouteDecision;
  let headers: Headers;

  const resolver: Resolver = (key) => {
    lookups.push(`${key.kind}:${key.value}`);
    const found = key.kind === "slug" ? bySlug[key.value] : byDomain[key.value];
    return Promise.resolve(found ?? null);
  };

  BeforeEachScenario(() => {
    bySlug = { horizonte: HORIZONTE };
    byDomain = {};
    lookups = [];
    decision = { kind: "pass" };
    headers = new Headers();
  });

  const arrive = async (host: string, path: string) => {
    decision = await decideRoute({ host, pathname: path }, resolver);
  };

  ScenarioOutline("Subdomínio identifica a imobiliária", ({ When, Then, And }, variables) => {
    When('chega uma requisição para "<host>" em "/"', async () => {
      await arrive(variables["host"] as string, "/");
    });
    Then('a imobiliária consultada é "horizonte"', () => {
      expect(lookups).toEqual(["slug:horizonte"]);
    });
    And('a página é servida de "/horizonte"', () => {
      expect(decision).toEqual({
        kind: "rewrite",
        pathname: "/horizonte",
        organizationId: "org-horizonte",
      });
    });
  });

  Scenario("Domínio próprio identifica a imobiliária", ({ Given, When, Then }) => {
    Given("o domínio {string} pertence à {string}", (_ctx, domain: string, slug: string) => {
      byDomain[domain] = { id: `org-${slug}`, slug };
    });
    When(
      "chega uma requisição para {string} em {string}",
      async (_ctx, host: string, path: string) => {
        await arrive(host, path);
      },
    );
    Then("a página é servida de {string}", (_ctx, path: string) => {
      expect(decision).toMatchObject({ kind: "rewrite", pathname: path });
    });
  });

  ScenarioOutline(
    "Endereço da plataforma não tem imobiliária",
    ({ When, Then, And }, variables) => {
      When('chega uma requisição para "<host>" em "/login"', async () => {
        await arrive(variables["host"] as string, "/login");
      });
      Then("nenhuma imobiliária é consultada", () => {
        expect(lookups).toEqual([]);
      });
      And("a requisição segue sem reescrita", () => {
        expect(decision).toEqual({ kind: "pass" });
      });
    },
  );

  Scenario("Imobiliária inexistente dá 404", ({ When, Then }) => {
    When(
      "chega uma requisição para {string} em {string}",
      async (_ctx, host: string, path: string) => {
        await arrive(host, path);
      },
    );
    Then("a resposta é {int}", (_ctx, status: number) => {
      expect(status).toBe(404);
      expect(decision).toEqual({ kind: "notFound" });
    });
  });

  ScenarioOutline("CRM e login ignoram o endereço", ({ When, Then, And }, variables) => {
    When('chega uma requisição para "horizonte.c1imob.com.br" em "<caminho>"', async () => {
      await arrive("horizonte.c1imob.com.br", variables["caminho"] as string);
    });
    Then("nenhuma imobiliária é consultada", () => {
      expect(lookups).toEqual([]);
    });
    And("a requisição segue sem reescrita", () => {
      expect(decision).toEqual({ kind: "pass" });
    });
  });

  Scenario("A imobiliária resolvida vai num cabeçalho interno", ({ When, Then }) => {
    When(
      "chega uma requisição para {string} em {string}",
      async (_ctx, host: string, path: string) => {
        await arrive(host, path);
        headers = sanitizeHeaders(
          new Headers(),
          decision.kind === "rewrite" ? decision.organizationId : null,
        );
      },
    );
    Then("o cabeçalho interno {string} é o da {string}", (_ctx, name: string, slug: string) => {
      expect(headers.get(name)).toBe(`org-${slug}`);
    });
  });

  Scenario("Cabeçalho interno forjado pelo visitante é descartado", ({ When, Then }) => {
    When(
      "chega uma requisição para {string} em {string} com o cabeçalho {string} igual a {string}",
      async (_ctx, host: string, path: string, name: string, value: string) => {
        await arrive(host, path);
        headers = sanitizeHeaders(
          new Headers({ [name]: value }),
          decision.kind === "rewrite" ? decision.organizationId : null,
        );
      },
    );
    Then("o cabeçalho interno {string} não existe", (_ctx, name: string) => {
      expect(headers.has(name)).toBe(false);
    });
  });

  Scenario("A consulta da imobiliária é guardada por um tempo", ({ When, Then, And }) => {
    let now = 0;
    let calls = 0;
    let cached: Resolver;
    const key = { kind: "slug", value: "horizonte" } as const;

    When(
      "a mesma imobiliária é consultada duas vezes em {int} segundos",
      async (_ctx, secs: number) => {
        now = 0;
        calls = 0;
        cached = cachedResolver(
          () => {
            calls += 1;
            return Promise.resolve(HORIZONTE);
          },
          { ttlMs: 60_000, now: () => now },
        );
        await cached(key);
        now = secs * 1000;
        await cached(key);
      },
    );
    Then("o banco é consultado uma vez", () => {
      expect(calls).toBe(1);
    });
    And("depois de {int} minutos o banco é consultado de novo", async (_ctx, mins: number) => {
      now = mins * 60_000;
      await cached(key);
      expect(calls).toBe(2);
    });
  });
});
