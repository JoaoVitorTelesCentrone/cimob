import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { isPlatformAdmin, loadMyOrganizationsWithSlug } from "@/lib/admin";
import { selectOrganization } from "../actions";
import { createOrganization } from "./actions";

export default function AgencyPage() {
  return (
    <Suspense fallback={<p className="p-6 text-ink-muted">Carregando...</p>}>
      <Agency />
    </Suspense>
  );
}

const field = "flex flex-col gap-1 text-sm font-semibold";
const input = "h-10 rounded-md border border-line bg-surface px-3 font-normal text-ink";

/** Tela da Center One: imobiliárias e criação de uma nova (com o convite ao gestor). */
async function Agency() {
  if (!(await isPlatformAdmin())) notFound();
  const orgs = await loadMyOrganizationsWithSlug();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">Agência</h1>
          <p className="text-sm text-ink-muted">Imobiliárias atendidas pela Center One</p>
        </div>
        <Link href="/app" className="text-sm underline">
          Voltar ao CRM
        </Link>
      </header>

      <section className="rounded-lg border border-line bg-surface-raised p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold uppercase">Nova imobiliária</h2>
        <ActionForm action={createOrganization} submitLabel="Criar e convidar" label="Nova imobiliária">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={field}>
              Nome da imobiliária
              <input name="name" required className={input} placeholder="Lumen Imóveis" />
            </label>
            <label className={field}>
              Endereço do site
              <input name="slug" className={input} placeholder="lumen (vazio: vem do nome)" />
            </label>
            <label className={field}>
              Nome do gestor
              <input name="adminName" required className={input} />
            </label>
            <label className={field}>
              E-mail do gestor
              <input name="adminEmail" type="email" required className={input} />
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="rounded-lg border border-line bg-surface-raised p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold uppercase">Imobiliárias</h2>
        {orgs.length === 0 ? (
          <p className="text-ink-muted">Nenhuma ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {orgs.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b>{o.name}</b> <span className="text-sm text-ink-muted">/{o.slug}</span>
                </span>
                <form action={selectOrganization}>
                  <input type="hidden" name="organizationId" value={o.id} />
                  <button className="text-sm font-semibold underline">Abrir</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
