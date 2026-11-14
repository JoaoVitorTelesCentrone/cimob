import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import {
  applyList,
  isLate,
  isNurture,
  parseListParams,
  type LeadRow,
  type ListParams,
} from "@/lib/leads/list";
import { STAGE_LABEL, type Stage } from "@/lib/leads/stages";
import { whatsappUrl } from "@/lib/leads/whatsapp";

const feature = await loadFeature("../../features/crm/lista-leads.feature", { language: "pt" });

type TableRow = Record<string, string>;

/** "2026-11-12 15:00" no fuso de São Paulo (-03:00). */
const at = (text: string) => new Date(`${text.replace(" ", "T")}:00-03:00`);

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let now: Date;
  let leads: LeadRow[] = [];
  let shown: LeadRow[] = [];
  let link = "";
  const owners = new Map<string, string>();

  const show = (params: Partial<ListParams>) => {
    shown = applyList(leads, { ...parseListParams({}), ...params }, now);
  };
  const names = () => shown.map((l) => l.name);
  const byName = (name: string) => {
    const lead = leads.find((l) => l.name === name);
    if (!lead) throw new Error(`lead desconhecido: ${name}`);
    return lead;
  };

  Background(({ Given, And }) => {
    Given("agora são {string}", (_ctx, text: string) => {
      now = at(text);
      shown = [];
      link = "";
    });
    And("os leads:", (_ctx, table: TableRow[]) => {
      leads = table.map((row, i) => {
        const owner = row["corretor"] ?? "";
        if (owner && !owners.has(owner)) owners.set(owner, `user-${owner.toLowerCase()}`);
        const assigned = row["atribuído às"] ?? "";
        return {
          id: `lead-${String(i + 1)}`,
          name: row["nome"] ?? "",
          phone: row["telefone"] ?? "",
          stage: (row["estágio"] ?? "new") as Stage,
          ownerId: owner ? (owners.get(owner) ?? null) : null,
          ownerName: owner || null,
          assignedAt: assigned ? at(assigned) : null,
          firstResponseAt: row["respondido"] === "sim" ? now : null,
          qualified: row["qualificado"] === "sim",
          createdAt: new Date(now.getTime() - i * 60_000),
        };
      });
    });
  });

  Scenario("Atrasados aparecem primeiro", ({ When, Then, And }) => {
    When("abro a lista de leads", () => {
      show({});
    });
    Then("o primeiro lead é {string}", (_ctx, name: string) => {
      expect(names()[0]).toBe(name);
    });
    And("{string} aparece como atrasado", (_ctx, name: string) => {
      expect(isLate(byName(name), now)).toBe(true);
    });
  });

  ScenarioOutline("Quando um lead está atrasado", ({ Then }, variables) => {
    Then('"<nome>" <situação>', () => {
      const expected = variables["situação"] === "está atrasado";
      expect(isLate(byName(variables["nome"] as string), now)).toBe(expected);
    });
  });

  Scenario("Busca pelo nome ignora acentos e maiúsculas", ({ When, Then }) => {
    When("busco por {string}", (_ctx, q: string) => {
      show({ q });
    });
    Then("a lista mostra só {string}", (_ctx, name: string) => {
      expect(names()).toEqual([name]);
    });
  });

  Scenario("Busca pelo telefone usa só os dígitos", ({ When, Then }) => {
    When("busco por {string}", (_ctx, q: string) => {
      show({ q });
    });
    Then("a lista mostra só {string}", (_ctx, name: string) => {
      expect(names()).toEqual([name]);
    });
  });

  Scenario("Filtro por estágio", ({ When, Then }) => {
    When("filtro pelo estágio {string}", (_ctx, stage: string) => {
      show(parseListParams({ stage }));
    });
    Then("a lista mostra {string} e {string}", (_ctx, a: string, b: string) => {
      expect([...names()].sort()).toEqual([a, b].sort());
    });
  });

  Scenario("Filtro só de atrasados", ({ When, Then }) => {
    When("filtro só os atrasados", () => {
      show(parseListParams({ late: "1" }));
    });
    Then("a lista mostra só {string}", (_ctx, name: string) => {
      expect(names()).toEqual([name]);
    });
  });

  Scenario(
    "Filtro de nutrição mostra quem o bot não qualificou e ainda está em Novo",
    ({ When, Then, And }) => {
      When("filtro os leads em nutrição", () => {
        show(parseListParams({ nurture: "1" }));
      });
      Then("a lista mostra só {string}", (_ctx, name: string) => {
        expect(names()).toEqual([name]);
      });
      And("{string} aparece como em nutrição", (_ctx, name: string) => {
        expect(isNurture(byName(name))).toBe(true);
      });
      And("{string} não aparece como em nutrição", (_ctx, name: string) => {
        expect(isNurture(byName(name))).toBe(false);
      });
    },
  );

  Scenario("Filtro por corretor", ({ When, Then }) => {
    When("filtro pelo corretor {string}", (_ctx, owner: string) => {
      show({ owner: owners.get(owner) ?? "?" });
    });
    Then("a lista mostra {string} e {string}", (_ctx, a: string, b: string) => {
      expect([...names()].sort()).toEqual([a, b].sort());
    });
  });

  Scenario("Ordenar por nome mantém os atrasados no topo", ({ When, Then }) => {
    When("ordeno por nome", () => {
      show(parseListParams({ sort: "name" }));
    });
    Then(
      "a ordem é {string}, {string}, {string}, {string}, {string}",
      (_ctx, a: string, b: string, c: string, d: string, e: string) => {
        expect(names()).toEqual([a, b, c, d, e]);
      },
    );
  });

  Scenario("Parâmetros inválidos no endereço são ignorados", ({ When, Then }) => {
    When("abro a lista com o endereço {string}", (_ctx, query: string) => {
      const params = Object.fromEntries(new URLSearchParams(query));
      shown = applyList(leads, parseListParams(params), now);
    });
    Then("a lista mostra os {int} leads", (_ctx, n: number) => {
      expect(shown).toHaveLength(n);
    });
  });

  Scenario("Botão do WhatsApp abre a conversa com o lead", ({ When, Then }) => {
    When("abro a ficha de {string}", (_ctx, name: string) => {
      link = whatsappUrl(byName(name).phone);
    });
    Then("o botão do WhatsApp aponta para {string}", (_ctx, url: string) => {
      expect(link).toBe(url);
    });
  });

  ScenarioOutline("Estágios aparecem em português", ({ Then }, variables) => {
    Then('o estágio "<estágio>" aparece como "<rótulo>"', () => {
      expect(STAGE_LABEL[variables["estágio"] as Stage]).toBe(variables["rótulo"]);
    });
  });
});
