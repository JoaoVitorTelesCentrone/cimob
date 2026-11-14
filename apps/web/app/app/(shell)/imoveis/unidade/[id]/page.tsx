import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ActionForm } from "@/components/action-form";
import { STATUS_LABEL, UNIT_STATUSES } from "@/lib/inventory";
import { loadMyRole } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { canManageTeam } from "@/lib/team";
import { saveUnit } from "./actions";

type Props = { params: Promise<{ id: string }> };

export default function UnitPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Carregando unidade...</p>}>
      <UnitEditor params={params} />
    </Suspense>
  );
}

const field = "flex flex-col gap-1 text-sm font-semibold";
const input = "h-10 rounded-md border border-line bg-surface px-3 font-normal text-ink";
const num = z
  .union([z.string(), z.number()])
  .nullable()
  .transform((v) => (v === null ? "" : String(v).replace(".", ",")));
const Unit = z.object({
  id: z.uuid(),
  code: z.string(),
  floor: z.number().nullable(),
  area_m2: num,
  bedrooms: z.number().nullable(),
  parking: z.number().nullable(),
  price: z
    .union([z.string(), z.number()])
    .nullable()
    .transform((v) => (v === null ? "" : String(Math.round(Number(v))))),
  status: z.enum(UNIT_STATUSES),
  developments: z.object({ name: z.string() }).nullable(),
});

async function UnitEditor({ params }: Props) {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const orgId = decision.organization.id;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await connection();
  const supabase = await createClient();
  const [{ data }, role] = await Promise.all([
    supabase
      .from("units")
      .select("id, code, floor, area_m2, bedrooms, parking, price, status, developments(name)")
      .eq("organization_id", orgId)
      .eq("id", id)
      .maybeSingle(),
    loadMyRole(orgId),
  ]);
  const unit = Unit.safeParse(data);
  if (!unit.success) notFound();
  const u = unit.data;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <header>
        <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">{u.code}</h1>
        <p className="text-sm text-ink-muted">
          {u.developments?.name ?? "—"} · {STATUS_LABEL[u.status]} ·{" "}
          <Link href="/app/imoveis" className="underline">
            Voltar aos imóveis
          </Link>
        </p>
      </header>
      {!canManageTeam(role) ? (
        <p role="status" className="rounded-lg border border-line bg-surface-raised p-4">
          Só o gestor edita a unidade.
        </p>
      ) : (
        <section className="rounded-lg border border-line bg-surface-raised p-4">
          <ActionForm action={saveUnit} submitLabel="Salvar unidade" label="Ficha da unidade">
            <input type="hidden" name="unitId" value={u.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={field}>
                Andar
                <input name="floor" inputMode="numeric" defaultValue={u.floor ?? ""} className={input} />
              </label>
              <label className={field}>
                Área (m²)
                <input name="areaM2" inputMode="decimal" defaultValue={u.area_m2} className={input} />
              </label>
              <label className={field}>
                Preço (R$)
                <input name="price" inputMode="decimal" defaultValue={u.price} placeholder="vazio: sem preço" className={input} />
              </label>
              <label className={field}>
                Quartos
                <input name="bedrooms" inputMode="numeric" defaultValue={u.bedrooms ?? ""} className={input} />
              </label>
              <label className={field}>
                Vagas
                <input name="parking" inputMode="numeric" defaultValue={u.parking ?? ""} className={input} />
              </label>
            </div>
            <p className="text-xs text-ink-muted">
              Campo vazio fica sem informação: o site não mostra e o bot passa a pergunta ao corretor.
              O status muda na lista de imóveis.
            </p>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
