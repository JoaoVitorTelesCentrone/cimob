import { monthlyReport, monthRange, type MonthlyReport } from "@c1imob/reports";
import { loadUnits } from "./inventory-queries";
import { loadDashboardLeads, loadMembers, loadSpendBetween } from "./leads/queries";

export type Stock = { available: number; reserved: number; sold: number };

/**
 * Relatório mensal com os dados que o RLS deixa quem pede ver (gestor e Center One veem tudo da
 * imobiliária; o corretor nem chega aqui). O DuckDB só calcula: não lê o banco.
 */
export async function loadMonthlyReport(
  organizationId: string,
  month: string,
  now: Date,
): Promise<{ report: MonthlyReport; stock: Stock }> {
  const range = monthRange(month);
  const previous = monthRange(range.previous);
  const members = await loadMembers(organizationId);
  const [leads, spend, units] = await Promise.all([
    loadDashboardLeads(organizationId, members),
    loadSpendBetween(organizationId, previous.firstDay, range.nextFirstDay),
    loadUnits(organizationId),
  ]);
  const report = await monthlyReport(
    {
      leads: leads.map((l) => ({
        id: l.id,
        source: l.source,
        stage: l.stage,
        qualified: l.qualified,
        ownerName: l.ownerName,
        assignedAt: l.assignedAt,
        firstResponseAt: l.firstResponseAt,
        createdAt: l.createdAt,
      })),
      spend,
    },
    month,
    now,
  );
  const stock = {
    available: units.filter((u) => u.status === "available").length,
    reserved: units.filter((u) => u.status === "reserved").length,
    sold: units.filter((u) => u.status === "sold").length,
  };
  return { report, stock };
}
