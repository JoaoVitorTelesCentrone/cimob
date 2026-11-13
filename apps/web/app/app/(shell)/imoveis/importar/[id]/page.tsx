import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { loadCurrentUnits, loadImport } from "@/lib/import-queries";
import { IMPORT_STATUS, KIND_LABEL, reviewImport, type ReviewKind } from "@/lib/imports";
import { formatArea, formatPrice, STATUS_CLASS, STATUS_LABEL } from "@/lib/inventory";
import { currentDecision } from "@/lib/org";
import { discardImport, publishImport } from "../actions";

type Props = { params: Promise<{ id: string }> };

export default function ReviewPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Carregando importação...</p>}>
      <Review params={params} />
    </Suspense>
  );
}

const panel = "rounded-lg border border-line bg-surface-raised p-4";
const th = "px-3 py-2 font-semibold";
const td = "px-3 py-2 align-top";
const num = "text-right tabular-nums";
const pill = "rounded-pill px-2 py-0.5 text-[11.5px] font-extrabold";
const KIND_CLASS: Record<ReviewKind, string> = {
  nova: "bg-brand-soft text-ink",
  muda: "bg-warning-soft text-warning-ink",
  igual: "bg-surface text-ink-muted",
  conflito: "bg-danger-soft text-danger",
};

/** Revisão do rascunho: o que cada linha do PDF vai fazer com as unidades, antes de publicar. */
async function Review({ params }: Props) {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const { id } = await params;
  const [imported, units] = await Promise.all([
    loadImport(id),
    loadCurrentUnits(decision.organization.id),
  ]);
  if (!imported) notFound();
  const { summary } = imported;
  const review = reviewImport(imported.rows, units, summary.developmentId);
  const draft = summary.status === "draft";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">
            Revisar importação
          </h1>
          <p className="text-sm text-ink-muted">
            {summary.fileName} · {summary.developmentName} ·{" "}
            <b className="text-ink">{IMPORT_STATUS[summary.status]}</b>
          </p>
        </div>
        <Link href="/app/imoveis/importar" className="text-sm underline">
          Importações
        </Link>
      </header>

      <section aria-label="Resumo da importação" className={`${panel} flex flex-wrap gap-4 text-sm`}>
        <span>
          <b>{review.counts.nova}</b> novas
        </span>
        <span>
          <b>{review.counts.muda}</b> mudam
        </span>
        <span>
          <b>{review.counts.igual}</b> iguais
        </span>
        {review.counts.revisar > 0 && (
          <span className="font-semibold text-warning-ink">
            {review.counts.revisar} para revisar (campo ilegível fica em branco)
          </span>
        )}
        {review.counts.conflito > 0 && (
          <span className="font-semibold text-danger">{review.counts.conflito} em conflito</span>
        )}
      </section>

      {summary.warnings.length > 0 && (
        <ul className="list-disc pl-6 text-sm text-ink-muted">
          {summary.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {!draft && (
        <p role="status" className={`${panel} text-sm font-semibold`}>
          {summary.status === "published"
            ? "Importação publicada: as unidades já valem para o site e para o bot."
            : "Importação descartada: nada mudou nas unidades."}
        </p>
      )}

      {draft && (
        <div className="flex flex-wrap items-start gap-4">
          {review.canPublish ? (
            <ActionButton
              action={publishImport}
              fields={{ importId: summary.id }}
              label="Publicar"
              className="h-10 rounded-pill bg-brand px-5 text-sm font-semibold text-on-brand"
            />
          ) : (
            <p role="alert" className="text-sm font-semibold text-danger">
              Há código que já é de outro empreendimento. Corrija o PDF ou o prefixo e importe de novo.
            </p>
          )}
          <ActionButton
            action={discardImport}
            fields={{ importId: summary.id }}
            label="Descartar"
            className="h-10 rounded-pill border border-line px-5 text-sm font-semibold"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-muted">
            <tr>
              <th className={th}>Unidade</th>
              <th className={th}>O que acontece</th>
              <th className={`${th} ${num}`}>Área</th>
              <th className={`${th} ${num}`}>Preço</th>
              <th className={th}>Situação</th>
              <th className={th}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {review.rows.map((r) => (
              <tr key={r.code} className="border-b border-line last:border-0">
                <td className={`${td} font-semibold`}>{r.code}</td>
                <td className={td}>
                  <span className={`${pill} ${KIND_CLASS[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                </td>
                <td className={`${td} ${num}`}>{formatArea(r.areaM2)}</td>
                <td className={`${td} ${num}`}>{formatPrice(r.price)}</td>
                <td className={td}>
                  {r.status ? (
                    <span className={`${pill} ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`${td} text-xs`}>
                  {[...r.changes, ...r.issues].join(" · ") || "—"}
                  {r.needsReview && (
                    <span className={`${pill} ml-2 bg-warning-soft text-warning-ink`}>Revisar</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
