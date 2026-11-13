import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { isPlatformAdmin, loadOrgSettings, loadTechnical } from "@/lib/admin";
import { loadMyRole } from "@/lib/leads/queries";
import { brandForm, criteriaForm, TIMEFRAMES } from "@/lib/onboarding";
import { currentDecision } from "@/lib/org";
import { canManageTeam } from "@/lib/team";
import { saveAdsAccount, saveBrand, saveCriteria, saveWhatsappAccount } from "./actions";

export default function ConfigPage() {
  return (
    <Suspense fallback={<p className="text-ink-muted">Carregando configurações...</p>}>
      <Config />
    </Suspense>
  );
}

const panel = "rounded-lg border border-line bg-surface-raised p-4";
const heading = "mb-1 font-display text-lg font-extrabold uppercase";
const hint = "mb-3 text-sm text-ink-muted";
const field = "flex flex-col gap-1 text-sm font-semibold";
const input = "h-10 rounded-md border border-line bg-surface px-3 font-normal text-ink";
const tokenStatus = (ok: boolean) => (ok ? "token guardado no cofre" : "sem token próprio");

async function Config() {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const orgId = decision.organization.id;

  const [settings, role, platform, technical] = await Promise.all([
    loadOrgSettings(orgId),
    loadMyRole(orgId),
    isPlatformAdmin(),
    loadTechnical(orgId),
  ]);
  const admin = canManageTeam(role);
  const brand = brandForm(settings?.brand ?? {});
  const criteria = criteriaForm(
    settings?.qualify_timeframe ?? "6m",
    settings?.qualify_price_share ?? "0.90",
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">
          Configurações
        </h1>
        <p className="text-sm text-ink-muted">
          Site: <b className="text-ink">/{settings?.slug}</b>
        </p>
      </header>

      {!admin ? (
        <p role="status" className={panel}>
          Só o gestor da imobiliária muda as configurações.
        </p>
      ) : (
        <>
          <section className={panel}>
            <h2 className={heading}>Marca</h2>
            <p className={hint}>Aparece no site e no CRM. Campo vazio não aparece no site.</p>
            <ActionForm action={saveBrand} submitLabel="Salvar marca" label="Marca">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={field}>
                  Cor principal
                  <input
                    name="color"
                    type="color"
                    defaultValue={brand.color}
                    className="h-10 w-20"
                  />
                </label>
                <label className={field}>
                  CRECI
                  <input name="creci" defaultValue={brand.creci} className={input} />
                </label>
                <label className={field}>
                  WhatsApp do site
                  <input
                    name="whatsapp"
                    defaultValue={brand.whatsapp}
                    inputMode="tel"
                    placeholder="(11) 91234-5678"
                    className={input}
                  />
                </label>
                <label className={field}>
                  Link do aviso de privacidade
                  <input
                    name="privacyUrl"
                    type="url"
                    defaultValue={brand.privacyUrl}
                    placeholder="https://"
                    className={input}
                  />
                </label>
              </div>
            </ActionForm>
          </section>

          <section className={panel}>
            <h2 className={heading}>Critério de qualificação</h2>
            <p className={hint}>
              O bot passa ao corretor quem compra dentro do prazo e tem faixa que cobre essa parte
              do preço da unidade. Os outros vão para nutrição.
            </p>
            <ActionForm
              action={saveCriteria}
              submitLabel="Salvar critério"
              label="Critério de qualificação"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={field}>
                  Prazo máximo de compra
                  <select name="timeframe" defaultValue={criteria.timeframe} className={input}>
                    {TIMEFRAMES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={field}>
                  Faixa cobre pelo menos (% do preço)
                  <input
                    name="priceShare"
                    type="number"
                    min={50}
                    max={100}
                    step={1}
                    defaultValue={criteria.priceShare}
                    className={input}
                  />
                </label>
              </div>
            </ActionForm>
          </section>
        </>
      )}

      <section className={panel}>
        <h2 className={heading}>WhatsApp do bot e anúncios</h2>
        <p className={hint}>
          {platform
            ? "Só a Center One configura. O token vai para o cofre e não aparece de novo; deixe vazio para manter o atual."
            : "Configurado pela Center One."}
        </p>
        <dl className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Número do bot (Phone Number ID)</dt>
            <dd>
              {technical.phoneNumberId
                ? `${technical.phoneNumberId} · ${tokenStatus(technical.whatsappToken)}`
                : "Não configurado"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Conta de anúncios</dt>
            <dd>
              {technical.adAccountId
                ? `${technical.adAccountId} · ${tokenStatus(technical.adsToken)}`
                : "Não configurada"}
            </dd>
          </div>
        </dl>
        {platform && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionForm
              action={saveWhatsappAccount}
              submitLabel="Salvar WhatsApp"
              label="WhatsApp do bot"
            >
              <label className={field}>
                Phone Number ID
                <input
                  name="phoneNumberId"
                  defaultValue={technical.phoneNumberId ?? ""}
                  className={input}
                />
              </label>
              <label className={field}>
                Token da Cloud API
                <input name="token" type="password" autoComplete="off" className={input} />
              </label>
            </ActionForm>
            <ActionForm
              action={saveAdsAccount}
              submitLabel="Salvar anúncios"
              label="Conta de anúncios"
            >
              <label className={field}>
                Conta de anúncios
                <input
                  name="adAccountId"
                  defaultValue={technical.adAccountId ?? ""}
                  placeholder="act_123"
                  className={input}
                />
              </label>
              <label className={field}>
                Token da Marketing API
                <input name="token" type="password" autoComplete="off" className={input} />
              </label>
            </ActionForm>
          </div>
        )}
      </section>
    </div>
  );
}
