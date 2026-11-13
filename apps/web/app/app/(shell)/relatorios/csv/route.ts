import { reportCsv } from "@c1imob/reports";
import { NextResponse, type NextRequest } from "next/server";
import { loadMyRole } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { loadMonthlyReport } from "@/lib/report-data";
import { parseMonth } from "@/lib/report-month";
import { canManageTeam } from "@/lib/team";

/** Marca de UTF-8: o Excel abre o CSV com acento certo. */
const BOM = String.fromCharCode(0xfeff);

/** CSV do relatório mensal (só gestor e Center One). */
export async function GET(request: NextRequest) {
  const decision = await currentDecision();
  if (decision.kind !== "enter") return new NextResponse("Escolha uma imobiliária", { status: 400 });
  const orgId = decision.organization.id;
  if (!canManageTeam(await loadMyRole(orgId))) {
    return new NextResponse("Só o gestor vê o relatório", { status: 403 });
  }
  const now = new Date();
  const month = parseMonth(request.nextUrl.searchParams.get("mes") ?? undefined, now);
  const { report } = await loadMonthlyReport(orgId, month, now);
  return new NextResponse(`${BOM}${reportCsv(report)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="relatorio-${month}.csv"`,
      "cache-control": "no-store",
    },
  });
}
