import Link from "next/link";
import { redirect } from "next/navigation";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { buildDashboard, parsePeriod, PERIODS } from "@/lib/leads/dashboard";
import {
  loadAdSpend,
  loadBusinessHours,
  loadDashboardLeads,
  loadMembers,
} from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";

type SearchParams = Record<string, string | string[] | undefined>;

const panel = "rounded-lg border border-line bg-surface-raised p-4";
const heading = "mb-3 font-display text-lg font-extrabold uppercase";
const th = "px-3 py-2 font-semibold";
const td = "px-3 py-2";
const num = "text-right tabular-nums";

export async function DashboardView({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const orgId = decision.organization.id;

  const period = parsePeriod((await searchParams)["period"]);
  const members = await loadMembers(orgId);
  const leads = await loadDashboardLeads(orgId, members);
  const now = new Date();
  const [spend, hours] = await Promise.all([loadAdSpend(orgId, now), loadBusinessHours(orgId)]);
  const d = buildDashboard(leads, members, period, now, spend, hours);
  const withCost = d.costKpis.length > 0;
  const top = Math.max(1, d.funnel[0]?.count ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresh organizationId={orgId} tables={["leads"]} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">Painel</h1>
          <p className="text-sm text-ink-muted">Do anúncio à visita, por origem e por corretor</p>
        </div>
        <nav aria-label="Período" className="flex gap-1 rounded-pill border border-line p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={p === 30 ? "/app" : `/app?period=${String(p)}`}
              aria-current={p === period ? "page" : undefined}
              className={`rounded-pill px-3 py-1 text-xs font-semibold ${
                p === period ? "bg-brand text-on-brand" : "text-ink-muted hover:bg-brand-soft"
              }`}
            >
              Últimos {p} dias
            </Link>
          ))}
        </nav>
      </header>

      {d.lateAlert && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <span className="font-semibold">{d.lateAlert.message}</span>
          <Link href={d.lateAlert.href} className="font-extrabold underline">
            Ver agora
          </Link>
        </div>
      )}

      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      >
        {d.kpis.map((k) => (
          <div key={k.label} className={panel}>
            <p className="text-xs font-semibold text-ink-muted">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{k.value}</p>
            <p className="text-[11.5px] text-ink-muted">{k.detail}</p>
          </div>
        ))}
      </section>

      {withCost && (
        <section aria-label="Custo de marketing" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {d.costKpis.map((k) => (
            <div key={k.label} className={panel}>
              <p className="text-xs font-semibold text-ink-muted">{k.label}</p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{k.value}</p>
              <p className="text-[11.5px] text-ink-muted">{k.detail}</p>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={panel}>
          <h2 className={heading}>Funil do período</h2>
          <ol className="flex flex-col gap-2">
            {d.funnel.map((step) => (
              <li
                key={step.label}
                className="grid grid-cols-[130px_1fr_40px] items-center gap-3 text-sm"
              >
                <span>{step.label}</span>
                <span className="h-3 rounded-pill bg-surface">
                  <span
                    className="block h-3 rounded-pill bg-brand"
                    style={{ width: `${String(Math.max(2, (step.count / top) * 100))}%` }}
                  />
                </span>
                <b className={num}>{step.count}</b>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${panel} overflow-x-auto`}>
          <h2 className={heading}>Por origem</h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-ink-muted">
              <tr>
                <th className={th}>Origem</th>
                <th className={`${th} ${num}`}>Leads</th>
                <th className={`${th} ${num}`}>Qualif.</th>
                <th className={`${th} ${num}`}>Visitas</th>
                {withCost && (
                  <>
                    <th className={`${th} ${num}`}>Investimento</th>
                    <th className={`${th} ${num}`}>CPL</th>
                    <th className={`${th} ${num}`}>Custo/visita</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {d.bySource.map((s) => (
                <tr key={s.source} className="border-b border-line last:border-0">
                  <td className={td}>{s.source}</td>
                  <td className={`${td} ${num}`}>{s.leads}</td>
                  <td className={`${td} ${num}`}>{s.qualified}</td>
                  <td className={`${td} ${num}`}>{s.visits}</td>
                  {withCost && (
                    <>
                      <td className={`${td} ${num}`}>{s.investment}</td>
                      <td className={`${td} ${num}`}>{s.cpl}</td>
                      <td className={`${td} ${num}`}>{s.costPerVisit}</td>
                    </>
                  )}
                </tr>
              ))}
              {d.bySource.length === 0 && (
                <tr>
                  <td colSpan={withCost ? 7 : 4} className={`${td} text-ink-muted`}>
                    Sem leads no período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className={`${panel} overflow-x-auto`}>
        <h2 className={heading}>Por corretor</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-muted">
            <tr>
              <th className={th}>Corretor</th>
              <th className={`${th} ${num}`}>Leads</th>
              <th className={`${th} ${num}`}>1ª resposta</th>
              <th className={`${th} ${num}`}>Visitas</th>
              <th className={`${th} ${num}`}>Propostas</th>
              <th className={`${th} ${num}`}>Atrasados</th>
            </tr>
          </thead>
          <tbody>
            {d.byAgent.map((a) => (
              <tr key={a.name} className="border-b border-line last:border-0">
                <td className={`${td} font-semibold`}>{a.name}</td>
                <td className={`${td} ${num}`}>{a.leads}</td>
                <td className={`${td} ${num}`}>{a.firstResponse}</td>
                <td className={`${td} ${num}`}>{a.visits}</td>
                <td className={`${td} ${num}`}>{a.proposals}</td>
                <td className={`${td} ${num} ${a.late ? "font-extrabold text-danger" : ""}`}>
                  {a.late}
                </td>
              </tr>
            ))}
            {d.byAgent.length === 0 && (
              <tr>
                <td colSpan={6} className={`${td} text-ink-muted`}>
                  Nenhum corretor ativo
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
