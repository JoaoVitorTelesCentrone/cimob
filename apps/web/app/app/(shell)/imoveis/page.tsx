import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import {
  buildInventory,
  formatArea,
  formatPrice,
  formatUnit,
  parseStatusFilter,
  STATUS_CLASS,
  STATUS_LABEL,
  UNIT_STATUSES,
  type UnitStatus,
} from "@/lib/inventory";
import { loadProperties, loadUnits } from "@/lib/inventory-queries";
import { loadMyRole } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { canManageTeam } from "@/lib/team";
import { StatusSelect } from "./status-select";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ImoveisPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Carregando imóveis...</p>}>
      <InventoryView searchParams={searchParams} />
    </Suspense>
  );
}

const panel = "overflow-x-auto rounded-lg border border-line bg-surface-raised";
const th = "px-3 py-2 font-semibold";
const td = "px-3 py-2";
const num = "text-right tabular-nums";
const pill = "rounded-pill px-2 py-0.5 text-[11.5px] font-extrabold";

function Status({
  kind,
  id,
  status,
  label,
  editable,
}: {
  kind: "unit" | "property";
  id: string;
  status: UnitStatus;
  label: string;
  editable: boolean;
}) {
  return editable ? (
    // A chave inclui o status: quando o Realtime traz um status novo, o seletor recomeça com ele.
    <StatusSelect key={`${id}:${status}`} kind={kind} id={id} status={status} label={label} />
  ) : (
    <span className={`${pill} ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
  );
}

async function InventoryView({ searchParams }: Props) {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const orgId = decision.organization.id;

  const filter = parseStatusFilter((await searchParams)["status"]);
  const [units, properties, role] = await Promise.all([
    loadUnits(orgId),
    loadProperties(orgId),
    loadMyRole(orgId),
  ]);
  const inventory = buildInventory(units, filter);
  const shownProperties = properties.filter((p) => !filter || p.status === filter);
  const editable = canManageTeam(role);

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresh organizationId={orgId} tables={["units", "properties"]} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">Imóveis</h1>
          <p className="text-sm text-ink-muted">
            {editable
              ? "Mudou aqui, muda no site e no espelho 3D."
              : "Só o gestor muda o status. A tela se atualiza sozinha."}
          </p>
          {editable && (
            <Link href="/app/imoveis/importar" className="text-sm font-semibold underline">
              Importar tabela de preços (PDF)
            </Link>
          )}
        </div>
        <nav aria-label="Status" className="flex gap-1 rounded-pill border border-line p-1">
          {[null, ...UNIT_STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={s ? `/app/imoveis?status=${s}` : "/app/imoveis"}
              aria-current={s === filter ? "page" : undefined}
              className={`rounded-pill px-3 py-1 text-xs font-semibold ${
                s === filter ? "bg-brand text-on-brand" : "text-ink-muted hover:bg-brand-soft"
              }`}
            >
              {s ? STATUS_LABEL[s] : "Todos"}
            </Link>
          ))}
        </nav>
      </header>

      {inventory.length === 0 && shownProperties.length === 0 && (
        <p className="rounded-lg border border-line bg-surface-raised p-6 text-ink-muted">
          Nenhum imóvel encontrado.
        </p>
      )}

      {inventory.map((group) => (
        <section key={group.development} className={panel}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
            <h2 className="font-display text-lg font-extrabold uppercase">{group.development}</h2>
            <p className="text-xs text-ink-muted">{group.summary}</p>
          </div>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-ink-muted">
              <tr>
                <th className={th}>Unidade</th>
                <th className={th}>Andar</th>
                <th className={`${th} ${num}`}>Área</th>
                <th className={`${th} ${num}`}>Quartos</th>
                <th className={`${th} ${num}`}>Preço</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {group.units.map((u) => {
                const f = formatUnit(u);
                return (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className={`${td} font-semibold`}>{u.code}</td>
                    <td className={td}>{f.floor}</td>
                    <td className={`${td} ${num}`}>{f.area}</td>
                    <td className={`${td} ${num}`}>{u.bedrooms ?? "—"}</td>
                    <td className={`${td} ${num}`}>{f.price}</td>
                    <td className={td}>
                      <Status
                        kind="unit"
                        id={u.id}
                        status={u.status}
                        label={u.code}
                        editable={editable}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      {shownProperties.length > 0 && (
        <section className={panel}>
          <h2 className="px-4 pt-4 font-display text-lg font-extrabold uppercase">
            Imóveis avulsos
          </h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-ink-muted">
              <tr>
                <th className={th}>Código</th>
                <th className={th}>Imóvel</th>
                <th className={th}>Bairro</th>
                <th className={`${th} ${num}`}>Área</th>
                <th className={`${th} ${num}`}>Preço</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {shownProperties.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className={`${td} font-semibold`}>{p.code}</td>
                  <td className={td}>{p.title}</td>
                  <td className={td}>{p.neighborhood ?? "—"}</td>
                  <td className={`${td} ${num}`}>{formatArea(p.areaM2)}</td>
                  <td className={`${td} ${num}`}>{formatPrice(p.price)}</td>
                  <td className={td}>
                    <Status
                      kind="property"
                      id={p.id}
                      status={p.status}
                      label={p.code}
                      editable={editable}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
