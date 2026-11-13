import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import {
  buildDashboard,
  parsePeriod,
  type Dashboard,
  type DashboardLead,
  type Period,
} from "@/lib/leads/dashboard";
import type { Member } from "@/lib/leads/queries";
import type { Stage } from "@/lib/leads/stages";

const feature = await loadFeature("../../features/crm/painel.feature", { language: "pt" });

type TableRow = Record<string, string>;

/** "2026-11-12 15:00" no fuso de São Paulo (-03:00). */
const at = (text: string) => new Date(`${text.replace(" ", "T")}:00-03:00`);
const optionalAt = (text: string | undefined) => (text ? at(text) : null);

const MEMBERS: Member[] = [
  { userId: "user-gestor", name: "Gestor", role: "org_admin" },
  { userId: "user-marina", name: "Marina", role: "agent" },
  { userId: "user-rafael", name: "Rafael", role: "agent" },
];
const ownerId = (name: string) => MEMBERS.find((m) => m.name === name)?.userId ?? null;

describeFeature(feature, ({ Background, Scenario }) => {
  let now: Date;
  let leads: DashboardLead[] = [];
  let period: Period = 30;
  let dashboard: Dashboard;

  const open = (p: Period) => {
    period = p;
    dashboard = buildDashboard(leads, MEMBERS, period, now);
  };
  const kpi = (label: string) => {
    const found = dashboard.kpis.find((k) => k.label === label);
    if (!found) throw new Error(`indicador desconhecido: ${label}`);
    return found;
  };
  const openSteps = (When: (text: string, fn: (ctx: unknown, n: number) => void) => void) => {
    When("abro o painel dos últimos {int} dias", (_ctx, n: number) => {
      open(parsePeriod(String(n)));
    });
  };

  Background(({ Given, And }) => {
    Given("agora são {string}", (_ctx, text: string) => {
      now = at(text);
    });
    And("os leads do painel:", (_ctx, table: TableRow[]) => {
      leads = table.map((row, i) => {
        const owner = row["corretor"] ?? "";
        const qualified = row["qualificado"];
        return {
          id: `lead-${String(i + 1)}`,
          name: row["nome"] ?? "",
          phone: `55119000000${String(i + 1)}`,
          stage: (row["estágio"] ?? "new") as Stage,
          source: row["origem"] || null,
          qualified: qualified ? qualified === "sim" : null,
          ownerId: owner ? ownerId(owner) : null,
          ownerName: owner || null,
          assignedAt: optionalAt(row["atribuído às"]),
          firstResponseAt: optionalAt(row["respondido às"]),
          createdAt: at(row["chegou em"] ?? ""),
        };
      });
    });
  });

  Scenario("KPIs dos últimos 30 dias", ({ When, Then }) => {
    openSteps(When);
    Then("os indicadores são:", (_ctx, table: TableRow[]) => {
      expect(dashboard.kpis).toEqual(
        table.map((r) => ({ label: r["indicador"], value: r["valor"], detail: r["detalhe"] })),
      );
    });
  });

  Scenario("O período muda os números", ({ When, Then, And }) => {
    openSteps(When);
    Then("o indicador {string} mostra {string}", (_ctx, label: string, value: string) => {
      expect(kpi(label).value).toBe(value);
    });
    And("o indicador {string} mostra {string}", (_ctx, label: string, value: string) => {
      expect(kpi(label).value).toBe(value);
    });
  });

  Scenario("Período inválido no endereço volta para 30 dias", ({ When, Then }) => {
    When("abro o painel com o endereço {string}", (_ctx, query: string) => {
      open(parsePeriod(new URLSearchParams(query).get("period") ?? undefined));
    });
    Then("o período é de {int} dias", (_ctx, n: number) => {
      expect(dashboard.period).toBe(n);
    });
  });

  Scenario("Funil do período conta quem passou por cada etapa", ({ When, Then }) => {
    openSteps(When);
    Then("o funil é:", (_ctx, table: TableRow[]) => {
      expect(dashboard.funnel).toEqual(
        table.map((r) => ({ label: r["etapa"], count: Number(r["leads"]) })),
      );
    });
  });

  Scenario("Por origem", ({ When, Then }) => {
    openSteps(When);
    Then("a tabela por origem é:", (_ctx, table: TableRow[]) => {
      expect(dashboard.bySource).toEqual(
        table.map((r) => ({
          source: r["origem"],
          leads: Number(r["leads"]),
          qualified: Number(r["qualificados"]),
          visits: Number(r["visitas"]),
          // Sem gasto importado não há colunas de custo (painel-custo.feature).
          investment: null,
          cpl: null,
          costPerVisit: null,
        })),
      );
    });
  });

  Scenario("Por corretor", ({ When, Then }) => {
    openSteps(When);
    Then("a tabela por corretor é:", (_ctx, table: TableRow[]) => {
      expect(dashboard.byAgent).toEqual(
        table.map((r) => ({
          name: r["corretor"],
          leads: Number(r["leads"]),
          firstResponse: r["1ª resposta"],
          visits: Number(r["visitas"]),
          proposals: Number(r["propostas"]),
          late: Number(r["atrasados"]),
        })),
      );
    });
  });

  Scenario("Sem respostas no período a mediana fica vazia", ({ Given, When, Then }) => {
    Given("nenhum lead foi respondido", () => {
      leads = leads.map((l) => ({ ...l, firstResponseAt: null }));
    });
    openSteps(When);
    Then("o indicador {string} mostra {string}", (_ctx, label: string, value: string) => {
      expect(kpi(label).value).toBe(value);
    });
  });

  Scenario("Alerta de atraso lista quem está esperando", ({ When, Then, And }) => {
    openSteps(When);
    Then("o painel mostra o alerta {string}", (_ctx, message: string) => {
      expect(dashboard.lateAlert?.message).toBe(message);
    });
    And("o alerta leva para a lista só de atrasados", () => {
      expect(dashboard.lateAlert?.href).toBe("/app/leads?late=1");
    });
  });

  Scenario("Sem atrasados não há alerta", ({ Given, When, Then }) => {
    Given("{string} já foi respondida", (_ctx, name: string) => {
      leads = leads.map((l) => (l.name === name ? { ...l, firstResponseAt: now } : l));
    });
    openSteps(When);
    Then("o painel não mostra alerta de atraso", () => {
      expect(dashboard.lateAlert).toBeNull();
    });
  });
});
