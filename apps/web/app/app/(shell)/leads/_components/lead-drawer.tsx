import type { BusinessHours } from "@c1imob/core";
import { EMPTY_CONVERSATION, type ConversationLine } from "@/lib/leads/conversation";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { formatDateTime, formatPhone } from "@/lib/format";
import { isLate } from "@/lib/leads/list";
import type { LeadDetail } from "@/lib/leads/queries";
import { STAGE_CLASS } from "@/lib/leads/stage-style";
import { STAGE_LABEL } from "@/lib/leads/stages";
import { whatsappUrl } from "@/lib/leads/whatsapp";
import { assignByRotation } from "../../equipe/actions";
import { deleteLeadData, recordFirstResponse, saveNextStep, saveVisit } from "../actions";
import { ActionForm } from "@/components/action-form";
import { isNextStepOverdue, toLocalInput } from "@/lib/leads/next-step";

const yesNo = (v: boolean | null) => (v === null ? "—" : v ? "Sim" : "Não");
const pill = "rounded-pill px-2 py-0.5 text-[11.5px] font-extrabold";

export function LeadDrawer({
  lead,
  closeHref,
  now,
  hours = null,
  conversation = [],
  canAssign = false,
  canWork = false,
  canManageData = false,
  confirmDelete = false,
  dataError = false,
}: {
  lead: LeadDetail | null;
  closeHref: string;
  now: Date;
  /** Horário de atendimento: o atraso conta só dentro dele (nulo = tempo corrido). */
  hours?: BusinessHours | null;
  /** Conversa do contato com o bot, em ordem (só leitura). */
  conversation?: ConversationLine[];
  /** Gestor vê o botão de distribuir pelo rodízio quando o lead está sem dono. */
  canAssign?: boolean;
  /** Corretor dono ou gestor: registra 1ª resposta, próximo passo e visita. */
  canWork?: boolean;
  /** Gestor exporta e exclui os dados do lead (LGPD). */
  canManageData?: boolean;
  /** Mostra o pedido de confirmação da exclusão (`?excluir=1`). */
  confirmDelete?: boolean;
  /** A exclusão falhou (`?lgpd=erro`). */
  dataError?: boolean;
}) {
  return (
    <>
      <Link
        href={closeHref}
        aria-label="Fechar ficha"
        className="fixed inset-0 z-10 bg-forest/40"
      />
      <aside
        aria-label="Ficha do lead"
        className="fixed inset-y-0 right-0 z-20 flex w-full max-w-md flex-col gap-5 overflow-y-auto bg-surface-raised p-5 shadow-[var(--shadow-overlay)]"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-[22px] leading-7 font-extrabold">
            {lead?.name ?? "Lead não encontrado"}
          </h2>
          <Link href={closeHref} className="text-sm text-ink-muted underline">
            Fechar
          </Link>
        </div>

        {!lead ? (
          <p className="text-ink-muted">Este lead não existe ou você não tem acesso a ele.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${pill} ${STAGE_CLASS[lead.stage]}`}>
                {STAGE_LABEL[lead.stage]}
              </span>
              {isLate(lead, now, hours) && (
                <span className={`${pill} bg-danger-soft text-danger`}>Atrasado</span>
              )}
              {lead.isDemo && (
                <span className={`${pill} bg-warning-soft text-warning-ink`}>Demonstração</span>
              )}
            </div>

            <a
              href={whatsappUrl(lead.phone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-fit items-center gap-2 rounded-pill bg-brand px-5 text-sm font-semibold text-on-brand"
            >
              Chamar no WhatsApp ↗
            </a>

            {canAssign && !lead.ownerId && (
              <ActionButton
                action={assignByRotation}
                fields={{ leadId: lead.id }}
                label="Atribuir pelo rodízio"
                className="h-10 rounded-pill border border-line px-5 text-sm font-semibold"
              />
            )}

            {lead.nextStep && (
              <p
                className={`rounded-sm border p-3 text-sm ${
                  isNextStepOverdue(lead, now)
                    ? "border-warning-ink bg-warning-soft"
                    : "border-line"
                }`}
              >
                <span className="text-xs font-semibold text-ink-muted">
                  Próximo passo{isNextStepOverdue(lead, now) ? " (vencido)" : ""}
                </span>
                <span className="block">
                  {lead.nextStep}
                  {lead.nextStepAt && ` · ${formatDateTime(lead.nextStepAt)}`}
                </span>
              </p>
            )}

            {canWork && (
              <section aria-label="Atendimento" className="flex flex-col gap-3">
                <h3 className="text-[15px] font-bold">Atendimento</h3>
                {!lead.firstResponseAt && (
                  <ActionButton
                    action={recordFirstResponse}
                    fields={{ leadId: lead.id }}
                    label="Registrar 1ª resposta"
                    className="h-10 rounded-pill border border-line px-5 text-sm font-semibold"
                  />
                )}
                <ActionForm
                  action={saveNextStep}
                  submitLabel="Salvar próximo passo"
                  label="Próximo passo"
                >
                  <input type="hidden" name="leadId" value={lead.id} />
                  <label className="flex flex-col gap-1 text-sm font-semibold">
                    Próximo passo
                    <input
                      name="text"
                      maxLength={200}
                      defaultValue={lead.nextStep ?? ""}
                      placeholder="Ex.: Ligar para confirmar a visita"
                      className="h-10 rounded-md border border-line bg-surface px-3 font-normal"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-semibold">
                    Quando
                    <input
                      name="at"
                      type="datetime-local"
                      defaultValue={toLocalInput(lead.nextStepAt ?? null)}
                      className="h-10 rounded-md border border-line bg-surface px-3 font-normal"
                    />
                  </label>
                </ActionForm>
                <ActionForm action={saveVisit} submitLabel="Marcar visita" label="Data da visita">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <label className="flex flex-col gap-1 text-sm font-semibold">
                    Data da visita
                    <input
                      name="at"
                      type="datetime-local"
                      required
                      defaultValue={toLocalInput(lead.visitAt)}
                      className="h-10 rounded-md border border-line bg-surface px-3 font-normal"
                    />
                  </label>
                </ActionForm>
              </section>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Telefone", formatPhone(lead.phone)],
                ["Corretor", lead.ownerName ?? "—"],
                ["Origem", lead.source ?? "—"],
                ["Unidade", lead.unitCode ?? "—"],
                ["Objetivo", lead.intent ?? "—"],
                ["Faixa", lead.budgetRange ?? "—"],
                ["Prazo", lead.timeframe ?? "—"],
                ["Quer visitar", yesNo(lead.wantsVisit)],
                ["Atribuído", formatDateTime(lead.assignedAt)],
                ["1ª resposta", formatDateTime(lead.firstResponseAt)],
                ["Visita", formatDateTime(lead.visitAt)],
                ["Motivo da perda", lead.lostReason ?? "—"],
              ].map(([term, value]) => (
                <div key={term} className="rounded-sm border border-line p-3">
                  <dt className="text-xs font-semibold text-ink-muted">{term}</dt>
                  <dd className="mt-1">{value}</dd>
                </div>
              ))}
            </dl>

            {canManageData && (
              <section aria-label="Dados do lead (LGPD)" className="flex flex-col gap-3">
                <h3 className="text-[15px] font-bold">Dados do lead (LGPD)</h3>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/app/leads/${lead.id}/exportar`}
                    download
                    className="inline-flex h-10 items-center rounded-pill border border-line px-5 text-sm font-semibold"
                  >
                    Exportar dados
                  </a>
                  {!confirmDelete && (
                    <Link
                      href={`/app/leads/${lead.id}?excluir=1`}
                      className="inline-flex h-10 items-center rounded-pill border border-danger px-5 text-sm font-semibold text-danger"
                    >
                      Excluir dados
                    </Link>
                  )}
                </div>
                {dataError && (
                  <p role="alert" className="text-sm text-danger">
                    Não foi possível excluir os dados. Tente de novo.
                  </p>
                )}
                {confirmDelete && (
                  <div
                    role="alertdialog"
                    aria-label="Confirmar exclusão"
                    className="flex flex-col gap-3 rounded-sm bg-danger-soft p-4 text-sm text-danger"
                  >
                    <p>
                      <b>A exclusão não pode ser desfeita.</b> Apaga a ficha, a conversa no
                      WhatsApp, o histórico, o consentimento e o resumo enviado ao corretor. Fica só
                      um registro anônimo de que a exclusão foi feita.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <form action={deleteLeadData}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <button
                          type="submit"
                          className="h-10 rounded-pill border-2 border-danger bg-surface-raised px-5 font-extrabold text-danger"
                        >
                          Confirmar exclusão
                        </button>
                      </form>
                      <Link
                        href={`/app/leads/${lead.id}`}
                        className="inline-flex h-10 items-center rounded-pill border border-line bg-surface-raised px-5 font-semibold text-ink"
                      >
                        Cancelar
                      </Link>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section aria-label="Conversa com o bot">
              <h3 className="mb-2 text-[15px] font-bold">Conversa com o bot</h3>
              {conversation.length === 0 ? (
                <p className="text-ink-muted">{EMPTY_CONVERSATION}</p>
              ) : (
                <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                  {conversation.map((m, i) => (
                    <li
                      key={i}
                      className={`flex max-w-[85%] flex-col rounded-lg px-3 py-2 text-sm ${
                        m.from === "bot"
                          ? "self-end bg-brand-soft"
                          : "self-start border border-line bg-surface"
                      }`}
                    >
                      <span className="whitespace-pre-line">{m.text}</span>
                      <span className="mt-1 text-[11px] text-ink-muted tabular-nums">
                        {m.from === "bot" ? "Bot" : "Contato"} · {formatDateTime(m.at)}
                        {m.status && (
                          <span className={m.status === "Não entregue" ? "text-danger" : ""}>
                            {" "}
                            · {m.status}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-[15px] font-bold">Histórico</h3>
              {lead.events.length === 0 ? (
                <p className="text-ink-muted">Sem eventos ainda.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {lead.events.map((e) => (
                    <li
                      key={e.id}
                      className="flex justify-between gap-2 border-b border-line pb-2 text-sm"
                    >
                      <span>
                        {e.title}
                        {e.detail && (
                          <span className="block text-xs text-ink-muted">{e.detail}</span>
                        )}
                      </span>
                      <span className="text-ink-muted tabular-nums">
                        {formatDateTime(e.createdAt)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </aside>
    </>
  );
}
