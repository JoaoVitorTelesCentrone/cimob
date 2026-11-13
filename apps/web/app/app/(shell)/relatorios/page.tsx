import { formatDelta, formatValue, type Metric } from "@c1imob/reports";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loadMyRole } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { loadMonthlyReport } from "@/lib/report-data";
import { monthOptions, parseMonth } from "@/lib/report-month";
import { canManageTeam } from "@/lib/team";
import { PrintButton } from "./print-button";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ReportPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Montando o relatório...</p>}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

const panel = "rounded-lg border border-line bg-surface-raised p-4 break-inside-avoid";
const heading = "mb-3 font-display text-lg font-extrabold uppercase";
const th = "px-3 py-2 font-semibold";
const td = "px-3 py-2";
const num = "text-right tabular-nums";

function MetricTable({ title, metrics, label }: { title: string; metrics: Metric[]; label: string }) {
  return (
    <section aria-label={label} className={panel}>
      <h2 className={heading}>{title}</h2>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs text-ink-muted">
          <tr>
            <th className={th}>Indicador</th>
            <th className={`${th} ${num}`}>Mês</th>
            <th className={`${th} ${num}`}>Mês anterior</th>
            <th className={`${th} ${num}`}>Variação</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.label} className="border-b border-line last:border-0">
              <td className={`${td} font-semibold`}>{m.label}</td>
              <td className={`${td} ${num}`}>
                {m.kind === "money" && m.value !== null ? "R$ " : ""}
                {formatValue(m.value, m.kind)}
              </td>
              <td className={`${td} ${num} text-ink-muted`}>{formatValue(m.previous, m.kind)}</td>
              <td className={`${td} ${num}`}>{formatDelta(m.value, m.previous, m.kind)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function Report({ searchParams }: Props) {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const orgId = decision.organization.id;
  const role = await loadMyRole(orgId);
  if (!canManageTeam(role)) {
    return (
      <p role="status" className={panel}>
        Só o gestor da imobiliária vê o relatório mensal.
      </p>
    );
  }

  const now = new Date();
  const month = parseMonth((await searchParams)["mes"], now);
  const { report, stock } = await loadMonthlyReport(orgId, month, now);

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">Relatório</h1>
          <p className="text-sm text-ink-muted">
            {decision.organization.name} · <b className="text-ink">{report.label}</b> · leads contados
            pelo mês em que chegaram
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <form method="get" className="flex items-center gap-2">
            <label className="text-sm font-semibold">
              <span className="sr-only">Mês</span>
              <select
                name="mes"
                defaultValue={month}
                aria-label="Mês do relatório"
                className="h-10 rounded-md border border-line bg-surface px-3 text-sm"
              >
                {monthOptions(now).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="h-10 rounded-pill border border-line px-4 text-sm font-semibold">Ver</button>
          </form>
          <a
            href={`/app/relatorios/csv?mes=${month}`}
            className="inline-flex h-10 items-center rounded-pill border border-line px-4 text-sm font-semibold"
          >
            Baixar CSV
          </a>
          <PrintButton />
        </div>
      </header>

      <MetricTable title="Funil" label="Funil do mês" metrics={report.funnel} />
      {report.cost.length > 0 && (
        <MetricTable title="Investimento em anúncios" label="Custo do mês" metrics={report.cost} />
      )}

      <section aria-label="Por origem" className={panel}>
        <h2 className={heading}>Por origem</h2>
        {report.bySource.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum lead no mês.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-ink-muted">
              <tr>
                <th className={th}>Origem</th>
                <th className={`${th} ${num}`}>Leads</th>
                <th className={`${th} ${num}`}>Qualificados</th>
                <th className={`${th} ${num}`}>Visitas</th>
              </tr>
            </thead>
            <tbody>
              {report.bySource.map((s) => (
                <tr key={s.source} className="border-b border-line last:border-0">
                  <td className={td}>{s.source}</td>
                  <td className={`${td} ${num}`}>{s.leads}</td>
                  <td className={`${td} ${num}`}>{s.qualified}</td>
                  <td className={`${td} ${num}`}>{s.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Por corretor" className={panel}>
        <h2 className={heading}>Por corretor</h2>
        {report.byAgent.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum lead atribuído no mês.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-ink-muted">
              <tr>
                <th className={th}>Corretor</th>
                <th className={`${th} ${num}`}>Leads</th>
                <th className={`${th} ${num}`}>1ª resposta (mediana)</th>
                <th className={`${th} ${num}`}>Visitas</th>
                <th className={`${th} ${num}`}>Respostas atrasadas</th>
              </tr>
            </thead>
            <tbody>
              {report.byAgent.map((a) => (
                <tr key={a.name} className="border-b border-line last:border-0">
                  <td className={`${td} font-semibold`}>{a.name}</td>
                  <td className={`${td} ${num}`}>{a.leads}</td>
                  <td className={`${td} ${num}`}>{formatValue(a.firstResponseMedian, "minutes")}</td>
                  <td className={`${td} ${num}`}>{a.visits}</td>
                  <td className={`${td} ${num} ${a.lateResponses ? "font-extrabold text-danger" : ""}`}>
                    {a.lateResponses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Estoque agora" className={panel}>
        <h2 className={heading}>Estoque agora</h2>
        <p className="text-sm">
          <b>{stock.available}</b> disponíveis · <b>{stock.reserved}</b> reservadas ·{" "}
          <b>{stock.sold}</b> vendidas
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Situação de hoje (ainda não guardamos o histórico de mudanças de estoque por mês).
        </p>
      </section>
    </div>
  );
}
