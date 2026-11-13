import { formatValue } from "./format.ts";
import type { MonthlyReport } from "./report.ts";

/** Célula de CSV com `;` (Excel em português usa vírgula como decimal). */
const cell = (v: string | number) => {
  const text = String(v);
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const line = (...cells: (string | number)[]) => cells.map(cell).join(";");

/** CSV do relatório mensal: funil e custo, por origem e por corretor. */
export function reportCsv(r: MonthlyReport): string {
  return [
    line("Relatório", r.label),
    "",
    line("Indicador", "Mês", "Mês anterior"),
    ...[...r.funnel, ...r.cost].map((m) => line(m.label, formatValue(m.value, m.kind), formatValue(m.previous, m.kind))),
    "",
    line("Origem", "Leads", "Qualificados", "Visitas"),
    ...r.bySource.map((s) => line(s.source, s.leads, s.qualified, s.visits)),
    "",
    line("Corretor", "Leads", "1ª resposta (mediana)", "Visitas", "Respostas atrasadas"),
    ...r.byAgent.map((a) =>
      line(a.name, a.leads, formatValue(a.firstResponseMedian, "minutes"), a.visits, a.lateResponses),
    ),
    "",
  ].join("\n");
}
