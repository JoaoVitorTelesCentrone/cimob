import { describe, expect, it } from "vitest";
import { reportCsv } from "./csv.ts";
import type { MonthlyReport } from "./report.ts";

const report: MonthlyReport = {
  month: "2026-11",
  label: "novembro de 2026",
  previous: "2026-10",
  funnel: [{ label: "Leads", value: 4, previous: 2, kind: "count" }],
  cost: [{ label: "CPL", value: 200, previous: null, kind: "money" }],
  bySource: [{ source: "Anúncio Meta; FB", leads: 3, qualified: 2, visits: 2 }],
  byAgent: [{ name: 'Ana "Lu"', leads: 2, firstResponseMedian: 115, visits: 2, lateResponses: 1 }],
};

describe("reportCsv", () => {
  it("uma seção por bloco, com ponto e vírgula (Excel em português) e aspas quando precisa", () => {
    expect(reportCsv(report).split("\n")).toEqual([
      "Relatório;novembro de 2026",
      "",
      "Indicador;Mês;Mês anterior",
      "Leads;4;2",
      "CPL;200,00;–",
      "",
      "Origem;Leads;Qualificados;Visitas",
      '"Anúncio Meta; FB";3;2;2',
      "",
      "Corretor;Leads;1ª resposta (mediana);Visitas;Respostas atrasadas",
      '"Ana ""Lu""";2;115 min;2;1',
      "",
    ]);
  });
});
