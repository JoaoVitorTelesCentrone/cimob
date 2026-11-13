import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import {
  buildDashboard,
  parsePeriod,
  type Dashboard,
  type DashboardLead,
  type Period,
  type SpendDay,
} from "@/lib/leads/dashboard";
import type { Stage } from "@/lib/leads/stages";

const feature = await loadFeature("../../features/crm/painel-custo.feature", { language: "pt" });

type TableRow = Record<string, string>;

/** "2026-11-12 15:00" no fuso de São Paulo (-03:00). */
const at = (text: string) => new Date(`${text.replace(" ", "T")}:00-03:00`);
/** "1.234,56" → 1234.56 */
const money = (text: string) => Number(text.replace(/\./g, "").replace(",", "."));

describeFeature(feature, ({ Background, Scenario }) => {
  let now: Date;
  let leads: DashboardLead[] = [];
  let spend: SpendDay[] = [];
  let dashboard: Dashboard;

  const open = (p: Period) => {
    dashboard = buildDashboard(leads, [], p, now, spend);
  };
  const openSteps = (When: (text: string, fn: (ctx: unknown, n: number) => void) => void) => {
    When("abro o painel dos últimos {int} dias", (_ctx, n: number) => {
      open(parsePeriod(String(n)));
    });
  };
  const costKpisAre = (Then: (text: string, fn: (ctx: unknown, t: TableRow[]) => void) => void) => {
    Then("os indicadores de custo são:", (_ctx, table: TableRow[]) => {
      expect(dashboard.costKpis).toEqual(
        table.map((r) => ({ label: r["indicador"], value: r["valor"], detail: r["detalhe"] })),
      );
    });
  };

  Background(({ Given, And }) => {
    Given("agora são {string}", (_ctx, text: string) => {
      now = at(text);
      spend = [];
    });
    And("os leads do painel:", (_ctx, table: TableRow[]) => {
      leads = table.map((row, i) => ({
        id: `lead-${String(i + 1)}`,
        name: row["nome"] ?? "",
        phone: `55119000000${String(i + 1)}`,
        stage: (row["estágio"] ?? "new") as Stage,
        source: row["origem"] || null,
        qualified: row["qualificado"] ? row["qualificado"] === "sim" : null,
        ownerId: null,
        ownerName: null,
        assignedAt: null,
        firstResponseAt: null,
        createdAt: at(row["chegou em"] ?? ""),
      }));
    });
    And("o gasto importado da Meta:", (_ctx, table: TableRow[]) => {
      spend = table.map((row) => ({
        date: at(`${row["data"] ?? ""} 00:00`),
        spend: money(row["gasto"] ?? "0"),
      }));
    });
  });

  Scenario("Investimento, CPL e custo por visita dos últimos 30 dias", ({ When, Then }) => {
    openSteps(When);
    costKpisAre(Then);
  });

  Scenario("O período muda o custo", ({ When, Then }) => {
    openSteps(When);
    costKpisAre(Then);
  });

  Scenario("Por origem mostra o custo só da linha de anúncio", ({ When, Then }) => {
    openSteps(When);
    Then("a tabela por origem com custo é:", (_ctx, table: TableRow[]) => {
      expect(dashboard.bySource).toEqual(
        table.map((r) => ({
          source: r["origem"],
          leads: Number(r["leads"]),
          qualified: Number(r["qualificados"]),
          visits: Number(r["visitas"]),
          investment: r["investimento"] ?? null,
          cpl: r["CPL"] ?? null,
          costPerVisit: r["custo por visita"] ?? null,
        })),
      );
    });
  });

  Scenario(
    "Sem lead de anúncio no período, CPL e custo por visita ficam vazios",
    ({ Given, When, Then }) => {
      Given("o painel sem leads", () => {
        leads = [];
      });
      openSteps(When);
      costKpisAre(Then);
    },
  );

  Scenario("Sem gasto importado o painel não fala de custo", ({ Given, When, Then, And }) => {
    Given("o painel sem gasto importado", () => {
      spend = [];
    });
    openSteps(When);
    Then("não há indicadores de custo", () => {
      expect(dashboard.costKpis).toEqual([]);
    });
    And("a tabela por origem não tem colunas de custo", () => {
      for (const row of dashboard.bySource) {
        expect(row.investment).toBeNull();
        expect(row.cpl).toBeNull();
        expect(row.costPerVisit).toBeNull();
      }
    });
  });
});
