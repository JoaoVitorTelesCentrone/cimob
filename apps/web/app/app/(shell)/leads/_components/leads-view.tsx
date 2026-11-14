import Link from "next/link";
import { redirect } from "next/navigation";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { formatDateTime, formatPhone } from "@/lib/format";
import { applyList, isLate, isNurture, parseListParams, type ListParams } from "@/lib/leads/list";
import {
  loadLead,
  loadLeads,
  loadMembers,
  loadBusinessHours,
  loadConversation,
  loadMyRole,
} from "@/lib/leads/queries";
import { STAGE_CLASS } from "@/lib/leads/stage-style";
import { STAGES, STAGE_LABEL } from "@/lib/leads/stages";
import { currentDecision } from "@/lib/org";
import { canManageTeam } from "@/lib/team";
import { LeadDrawer } from "./lead-drawer";
import { isNextStepOverdue } from "@/lib/leads/next-step";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Record<string, string | string[] | undefined>;

/** Reconstrói a query string dos filtros (para manter o filtro ao abrir e fechar a ficha). */
function toQuery(p: ListParams): string {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.stage) qs.set("stage", p.stage);
  if (p.owner) qs.set("owner", p.owner);
  if (p.late) qs.set("late", "1");
  if (p.nurture) qs.set("nurture", "1");
  if (p.sort !== "recent") qs.set("sort", p.sort);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

const field = "h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink";
const label = "flex flex-col gap-1 text-xs font-semibold text-ink-muted";
const pill = "rounded-pill px-2 py-0.5 text-[11.5px] font-extrabold";

export async function LeadsView({
  searchParams,
  leadId,
}: {
  searchParams: Promise<SearchParams>;
  leadId?: string;
}) {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const orgId = decision.organization.id;

  const raw = await searchParams;
  const params = parseListParams(raw);
  const members = await loadMembers(orgId);
  const [all, detail, role, hours, conversation] = await Promise.all([
    loadLeads(orgId, members),
    leadId ? loadLead(orgId, leadId, members) : Promise.resolve(null),
    loadMyRole(orgId),
    loadBusinessHours(orgId),
    leadId ? loadConversation(orgId, leadId) : Promise.resolve([]),
  ]);
  const myId = leadId
    ? ((await (await createClient()).auth.getUser()).data.user?.id ?? null)
    : null;
  const now = new Date();
  const leads = applyList(all, params, now, hours);
  const lateCount = all.filter((l) => isLate(l, now, hours)).length;
  const query = toQuery(params);

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresh organizationId={orgId} tables={["leads", "lead_events"]} />
      <header className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">Leads</h1>
        {lateCount > 0 && (
          <p role="status" className={`${pill} bg-danger-soft px-3 py-1 text-xs text-danger`}>
            {lateCount === 1
              ? "1 lead sem primeira resposta há mais de 2 h"
              : `${String(lateCount)} leads sem primeira resposta há mais de 2 h`}
          </p>
        )}
      </header>

      {raw["lgpd"] === "excluido" && (
        <p role="status" className="rounded-lg bg-brand-soft px-4 py-3 text-sm font-semibold">
          Dados do lead excluídos
        </p>
      )}

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface-raised p-4"
      >
        <label className={label}>
          Buscar
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Nome ou telefone"
            className={`${field} w-56`}
          />
        </label>
        <label className={label}>
          Estágio
          <select name="stage" defaultValue={params.stage ?? ""} className={field}>
            <option value="">Todos</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {members.length > 1 && (
          <label className={label}>
            Corretor
            <select name="owner" defaultValue={params.owner ?? ""} className={field}>
              <option value="">Todos</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={label}>
          Ordenar
          <select name="sort" defaultValue={params.sort} className={field}>
            <option value="recent">Mais recentes</option>
            <option value="name">Nome</option>
          </select>
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="late" value="1" defaultChecked={params.late} />
          Só atrasados
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="nurture" value="1" defaultChecked={params.nurture} />
          Só em nutrição
        </label>
        <button className="h-10 rounded-pill bg-brand px-5 text-sm font-semibold text-on-brand">
          Filtrar
        </button>
        <Link href="/app/leads" className="h-10 content-center text-xs text-ink-muted underline">
          Limpar
        </Link>
      </form>

      <p className="text-xs text-ink-muted">
        {leads.length} de {all.length} leads
      </p>

      {leads.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface-raised p-6 text-ink-muted">
          Nenhum lead encontrado com esses filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-semibold text-ink-muted">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Estágio</th>
                <th className="px-4 py-3">Corretor</th>
                <th className="px-4 py-3">Atribuído</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-line last:border-0 hover:bg-surface">
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/app/leads/${lead.id}${query}`} className="hover:underline">
                      {lead.name}
                    </Link>
                    {isNextStepOverdue(lead, now) && (
                      <span className={`${pill} ml-2 bg-warning-soft text-warning-ink`}>
                        Próximo passo vencido
                      </span>
                    )}
                    {isLate(lead, now, hours) && (
                      <span className={`${pill} ml-2 bg-danger-soft text-danger`}>Atrasado</span>
                    )}
                    {isNurture(lead) && (
                      <span
                        className={`${pill} ml-2 bg-surface text-ink-muted`}
                        title="O bot não qualificou: prazo longo ou faixa abaixo do preço"
                      >
                        Nutrição
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatPhone(lead.phone)}</td>
                  <td className="px-4 py-3">
                    <span className={`${pill} ${STAGE_CLASS[lead.stage]}`}>
                      {STAGE_LABEL[lead.stage]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{lead.ownerName ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted tabular-nums">
                    {formatDateTime(lead.assignedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {leadId && (
        <LeadDrawer
          lead={detail}
          closeHref={`/app/leads${query}`}
          now={now}
          hours={hours}
          conversation={conversation}
          canAssign={canManageTeam(role)}
          canWork={canManageTeam(role) || (detail?.ownerId !== null && detail?.ownerId === myId)}
          canManageData={canManageTeam(role)}
          confirmDelete={raw["excluir"] === "1"}
          dataError={raw["lgpd"] === "erro"}
        />
      )}
    </div>
  );
}
