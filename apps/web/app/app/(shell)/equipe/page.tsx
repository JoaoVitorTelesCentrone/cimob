import { Suspense } from "react";
import { redirect } from "next/navigation";
import { loadDashboardLeads, loadMyRole, loadNextInRotation, loadTeam } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { buildTeam, canManageTeam } from "@/lib/team";
import { cancelInvitation, inviteMember, resendInvitation, setMemberActive, setRotation } from "./actions";
import { ActionForm } from "@/components/action-form";
import { loadInactiveMembers, loadPendingInvitations } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { WhatsappForm } from "./whatsapp-form";
import { ActionButton } from "@/components/action-button";
import { formatPhone } from "@/lib/format";

export default function EquipePage() {
  return (
    <Suspense fallback={<p className="text-ink-muted">Carregando equipe...</p>}>
      <TeamView />
    </Suspense>
  );
}

const th = "px-3 py-2 font-semibold";
const td = "px-3 py-2";
const num = "text-right tabular-nums";
const pill = "rounded-pill px-2 py-0.5 text-[11.5px] font-extrabold";
const field = "flex flex-col gap-1 text-sm font-semibold";
const input = "h-10 rounded-md border border-line bg-surface px-3 font-normal text-ink";

async function TeamView() {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const orgId = decision.organization.id;

  const [members, role, next] = await Promise.all([
    loadTeam(orgId),
    loadMyRole(orgId),
    loadNextInRotation(orgId),
  ]);
  const leads = await loadDashboardLeads(orgId, members);
  const team = buildTeam(members, leads, next, new Date());
  const manage = canManageTeam(role);
  const [pending, inactive, me] = manage
    ? await Promise.all([
        loadPendingInvitations(orgId),
        loadInactiveMembers(orgId),
        createClient().then((sb) => sb.auth.getUser()),
      ])
    : [[], [], null];
  const myId = me?.data.user?.id ?? null;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">Equipe</h1>
        <p className="text-sm text-ink-muted">
          Rodízio de leads e desempenho dos últimos 30 dias
          {team.nextName && (
            <>
              {" "}
              · próximo da vez: <b className="text-ink">{team.nextName}</b>
            </>
          )}
        </p>
      </header>

      {manage && team.warning && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger"
        >
          {team.warning}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-muted">
            <tr>
              <th className={th}>Nome</th>
              <th className={th}>Papel</th>
              <th className={th}>Rodízio</th>
              <th className={th}>WhatsApp</th>
              <th className={`${th} ${num}`}>Leads</th>
              <th className={`${th} ${num}`}>1ª resposta</th>
              <th className={`${th} ${num}`}>Visitas</th>
              <th className={`${th} ${num}`}>Propostas</th>
              <th className={`${th} ${num}`}>Atrasados</th>
              {manage && <th className={th}>Acesso</th>}
            </tr>
          </thead>
          <tbody>
            {team.rows.map((r) => (
              <tr key={r.userId} className="border-b border-line last:border-0">
                <td className={`${td} font-semibold`}>
                  {r.name}
                  {r.isNext && (
                    <span className={`${pill} ml-2 bg-brand-soft text-ink`}>Próximo da vez</span>
                  )}
                </td>
                <td className={td}>{r.roleLabel}</td>
                <td className={td}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`${pill} ${r.inRotation ? "bg-available-soft text-available-ink" : "bg-surface text-ink-muted"}`}
                    >
                      {r.inRotation ? "No rodízio" : "Fora"}
                    </span>
                    {manage && (
                      <ActionButton
                        action={setRotation}
                        fields={{ userId: r.userId, inRotation: String(!r.inRotation) }}
                        label={r.inRotation ? "Tirar" : "Colocar"}
                        className="text-xs font-semibold underline"
                      />
                    )}
                  </div>
                </td>
                <td className={td}>
                  {manage ? (
                    <WhatsappForm
                      key={`${r.userId}:${r.whatsapp ?? ""}`}
                      userId={r.userId}
                      name={r.name}
                      whatsapp={r.whatsapp}
                    />
                  ) : (
                    <span className="tabular-nums">
                      {r.whatsapp ? formatPhone(r.whatsapp) : "—"}
                    </span>
                  )}
                </td>
                <td className={`${td} ${num}`}>{r.leads}</td>
                <td className={`${td} ${num}`}>{r.firstResponse}</td>
                <td className={`${td} ${num}`}>{r.visits}</td>
                <td className={`${td} ${num}`}>{r.proposals}</td>
                <td className={`${td} ${num} ${r.late ? "font-extrabold text-danger" : ""}`}>
                  {r.late}
                </td>
                {manage && (
                  <td className={td}>
                    {r.userId !== myId && r.roleLabel !== "Agência" && (
                      <ActionButton
                        action={setMemberActive}
                        fields={{ userId: r.userId, active: "false" }}
                        label={`Desativar ${r.name}`}
                        className="text-xs font-semibold text-danger underline"
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!manage && <p className="text-xs text-ink-muted">Só o gestor muda quem está no rodízio.</p>}

      {manage && (
        <section className="rounded-lg border border-line bg-surface-raised p-4">
          <h2 className="mb-3 font-display text-lg font-extrabold uppercase">Convidar</h2>
          <ActionForm action={inviteMember} submitLabel="Enviar convite" label="Convidar para a equipe">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className={field}>
                Nome
                <input name="name" required className={input} />
              </label>
              <label className={field}>
                E-mail
                <input name="email" type="email" required className={input} />
              </label>
              <label className={field}>
                WhatsApp
                <input name="whatsapp" inputMode="tel" placeholder="(11) 91234-5678" className={input} />
              </label>
              <label className={field}>
                Papel
                <select name="role" defaultValue="agent" className={input}>
                  <option value="agent">Corretor</option>
                  <option value="org_admin">Gestor</option>
                </select>
              </label>
            </div>
          </ActionForm>

          {pending.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-[15px] font-bold">Convites pendentes</h3>
              <ul aria-label="Convites pendentes" className="flex flex-col gap-1 text-sm">
                {pending.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      <b>{i.name}</b> · {i.email} · {i.role === "org_admin" ? "Gestor" : "Corretor"}
                    </span>
                    <ActionButton
                      action={resendInvitation}
                      fields={{ invitationId: i.id }}
                      label={`Reenviar convite de ${i.name}`}
                      className="text-xs font-semibold underline"
                    />
                    <ActionButton
                      action={cancelInvitation}
                      fields={{ invitationId: i.id }}
                      label={`Cancelar convite de ${i.name}`}
                      className="text-xs font-semibold text-danger underline"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {inactive.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-[15px] font-bold">Sem acesso</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {inactive.map((m) => (
                  <li key={m.userId} className="flex flex-wrap items-center gap-2">
                    {m.name}
                    <ActionButton
                      action={setMemberActive}
                      fields={{ userId: m.userId, active: "true" }}
                      label={`Reativar ${m.name}`}
                      className="text-xs font-semibold underline"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
