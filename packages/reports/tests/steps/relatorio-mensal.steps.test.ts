import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { formatValue, monthlyReport, type MonthlyReport, type ReportInput } from "../../src/index.ts";

const feature = await loadFeature("../../features/crm/relatorio-mensal.feature", { language: "pt" });

type TableRow = Record<string, string>;
/** "2026-11-03 10:00" em Brasília. */
const at = (text: string) => (text ? new Date(`${text.replace(" ", "T")}:00-03:00`) : null);
const money = (text: string) => Number(text.replace(/\./g, "").replace(",", "."));
const NOW = new Date("2026-12-02T09:00:00-03:00");

describeFeature(feature, ({ Background, Scenario }) => {
  const input: ReportInput = { leads: [], spend: [] };
  let report: MonthlyReport;

  Background(({ Given, And }) => {
    Given("os leads da imobiliária:", (_ctx, table: TableRow[]) => {
      input.leads = table.map((r, i) => {
        const created = at(r["chegou em"] ?? "") ?? NOW;
        return {
          id: `lead-${String(i)}`,
          source: r["origem"] === "Anúncio Meta" ? "meta_ads" : (r["origem"] ?? null),
          stage: r["estágio"] ?? "new",
          qualified: r["qualificado"] === "sim",
          ownerName: r["corretor"] || null,
          // O corretor recebe na chegada (rodízio na hora).
          assignedAt: r["corretor"] ? created : null,
          firstResponseAt: at(r["1ª resposta em"] ?? ""),
          createdAt: created,
        };
      });
    });
    And("o gasto em anúncios:", (_ctx, table: TableRow[]) => {
      input.spend = table.map((r) => ({ date: r["data"] ?? "", spend: money(r["gasto"] ?? "0") }));
    });
  });

  const generate = (When: (t: string, f: (c: unknown, month: string) => Promise<void>) => void) => {
    When("gero o relatório de {string}", async (_ctx, month) => {
      report = await monthlyReport(input, month, NOW);
    });
  };
  const metricsAre = (key: "funnel" | "cost") => (_ctx: unknown, table: TableRow[]) => {
    expect(
      report[key].map((m) => ({
        indicador: m.label,
        mês: formatValue(m.value, m.kind),
        "mês anterior": formatValue(m.previous, m.kind),
      })),
    ).toEqual(table);
  };

  Scenario("Funil do mês com a variação contra o mês anterior", ({ When, Then }) => {
    generate(When);
    Then("o funil do relatório é:", metricsAre("funnel"));
  });

  Scenario("Custo do mês só com os leads e o gasto do próprio mês", ({ When, Then }) => {
    generate(When);
    Then("o custo do relatório é:", metricsAre("cost"));
  });

  Scenario("Desempenho por corretor no mês", ({ When, Then }) => {
    generate(When);
    Then("o relatório por corretor é:", (_ctx, table: TableRow[]) => {
      expect(
        report.byAgent.map((a) => ({
          corretor: a.name,
          leads: String(a.leads),
          "1ª resposta (mediana)": formatValue(a.firstResponseMedian, "minutes"),
          visitas: String(a.visits),
          "respostas atrasadas": String(a.lateResponses),
        })),
      ).toEqual(table);
    });
  });

  Scenario("Por origem no mês", ({ When, Then }) => {
    generate(When);
    Then("o relatório por origem é:", (_ctx, table: TableRow[]) => {
      expect(
        report.bySource.map((s) => ({
          origem: s.source,
          leads: String(s.leads),
          qualificados: String(s.qualified),
          visitas: String(s.visits),
        })),
      ).toEqual(table);
    });
  });

  Scenario("Mês sem gasto não fala de custo", ({ When, Then, And }) => {
    generate(When);
    Then("o relatório não tem custo", () => {
      expect(report.cost).toEqual([]);
    });
    And("o funil do relatório tem {int} leads", (_ctx, n: number) => {
      expect(report.funnel[0]?.value).toBe(n);
    });
  });
});
