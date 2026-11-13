import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { loadDevelopments, loadRecentImports } from "@/lib/import-queries";
import { IMPORT_STATUS } from "@/lib/imports";
import { loadMyRole } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { canManageTeam } from "@/lib/team";
import { importPdf } from "./actions";

export default function ImportPage() {
  return (
    <Suspense fallback={<p className="text-ink-muted">Carregando...</p>}>
      <Import />
    </Suspense>
  );
}

const panel = "rounded-lg border border-line bg-surface-raised p-4";
const field = "flex flex-col gap-1 text-sm font-semibold";
const input = "h-10 rounded-md border border-line bg-surface px-3 font-normal text-ink";

async function Import() {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const orgId = decision.organization.id;
  const [role, developments, recent] = await Promise.all([
    loadMyRole(orgId),
    loadDevelopments(orgId),
    loadRecentImports(orgId),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">Importar PDF</h1>
        <p className="text-sm text-ink-muted">
          Tabela de preços da incorporadora. Vira um rascunho: nada muda no site até você revisar e
          publicar.
        </p>
      </header>

      {!canManageTeam(role) ? (
        <p role="status" className={panel}>
          Só o gestor importa tabelas.
        </p>
      ) : developments.length === 0 ? (
        <p className={panel}>Cadastre um empreendimento antes de importar.</p>
      ) : (
        <section className={panel}>
          <ActionForm action={importPdf} submitLabel="Ler PDF" label="Importar tabela de preços">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>
                Empreendimento
                <select name="developmentId" required className={input}>
                  {developments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={field}>
                Prefixo dos códigos (opcional)
                <input name="prefix" placeholder="AUR- (vazio: o das unidades)" className={input} />
              </label>
              <label className={`${field} sm:col-span-2`}>
                PDF (até 20 MB)
                <input name="file" type="file" accept="application/pdf" required className="text-sm font-normal" />
              </label>
            </div>
          </ActionForm>
        </section>
      )}

      {recent.length > 0 && (
        <section className={panel}>
          <h2 className="mb-2 font-display text-lg font-extrabold uppercase">Importações recentes</h2>
          <ul className="flex flex-col divide-y divide-line text-sm">
            {recent.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2 py-2">
                <Link href={`/app/imoveis/importar/${i.id}`} className="font-semibold underline">
                  {i.fileName}
                </Link>
                <span className="text-ink-muted">
                  {i.developmentName} · {IMPORT_STATUS[i.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
