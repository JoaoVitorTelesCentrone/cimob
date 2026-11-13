import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { brandCssVars } from "@c1imob/ui";
import { buildSite, type DevelopmentView } from "@/lib/site/model";
import { loadPublishedDevelopments, siteBrand } from "@/lib/site/queries";
import { resolveTenant } from "@/lib/tenant/resolver";
import { UnitPicker } from "./_components/unit-picker";

type Props = { params: Promise<{ tenant: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection(); // o cache de imobiliárias usa a hora: só na requisição
  const { tenant: slug } = await params;
  const tenant = await resolveTenant({ kind: "slug", value: slug });
  return { title: tenant?.name ?? "Imobiliária" };
}

export default function TenantHome({ params }: Props) {
  return (
    <Suspense fallback={<p className="p-6 text-ink-muted">Carregando...</p>}>
      <Tenant params={params} />
    </Suspense>
  );
}

/** White label: só os tokens `brand*` mudam. Sem cor válida, fica a marca Center One. */
function brandStyle(brand: Record<string, unknown>): React.CSSProperties | undefined {
  const color = typeof brand["color"] === "string" ? brand["color"] : null;
  try {
    return color ? brandCssVars(color) : undefined;
  } catch {
    return undefined;
  }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^\p{Lu}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("") || name.slice(0, 2).toUpperCase();

const button =
  "inline-flex h-11 items-center justify-center rounded-pill px-6 text-sm font-semibold";

function WhatsappLink({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${button} ${primary ? "bg-brand text-on-brand" : "border border-line bg-surface-raised text-ink"}`}
    >
      {label}
    </a>
  );
}

function Development({ dev, featured }: { dev: DevelopmentView; featured: boolean }) {
  const Title = featured ? "h1" : "h2";
  return (
    <section
      aria-label={dev.name}
      className={
        featured ? "flex flex-col gap-5" : "rounded-lg border border-line bg-surface-raised p-5"
      }
    >
      <div className="flex flex-col gap-2">
        <Title
          className={`font-display font-extrabold tracking-tight uppercase ${
            featured ? "text-[40px] leading-[1.05] sm:text-[56px]" : "text-[22px] leading-7"
          }`}
        >
          {dev.name}
        </Title>
        {dev.summary && <p className="text-ink-muted">{dev.summary}</p>}
      </div>
      <dl className="flex flex-wrap gap-3">
        <div className="rounded-md bg-available-soft px-4 py-3">
          <dt className="sr-only">Disponibilidade</dt>
          <dd className="font-semibold text-available-ink">{dev.availability}</dd>
        </div>
        {dev.fromPrice && (
          <div className="rounded-md bg-surface-raised px-4 py-3 shadow-[var(--shadow-card)]">
            <dt className="sr-only">Preço</dt>
            <dd className="font-semibold">{dev.fromPrice}</dd>
          </div>
        )}
      </dl>
      {dev.whatsappUrl && (
        <div className="flex flex-wrap gap-3">
          <WhatsappLink href={dev.whatsappUrl} label="Quero saber mais ↗" primary />
          {dev.visitUrl && <WhatsappLink href={dev.visitUrl} label="Agendar visita" />}
        </div>
      )}
    </section>
  );
}

async function Tenant({ params }: Props) {
  // Cache de imobiliárias, disponibilidade e "entrega x pronto para morar" dependem da hora.
  await connection();
  const { tenant: slug } = await params;
  const tenant = await resolveTenant({ kind: "slug", value: slug });
  if (!tenant) notFound();

  const brand = siteBrand(tenant.name, tenant.brand);
  const site = buildSite(brand, await loadPublishedDevelopments(tenant.id));
  const featured = site.featured;

  return (
    <div style={brandStyle(tenant.brand)} className="min-h-screen bg-surface text-ink">
      {site.demoNotice && (
        <p role="note" className="bg-warning-soft px-4 py-2 text-center text-xs text-warning-ink">
          {site.demoNotice}
        </p>
      )}

      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-md bg-brand font-display font-extrabold text-on-brand"
          >
            {initials(brand.name)}
          </span>
          <div>
            <p className="font-display text-lg leading-5 font-extrabold">{brand.name}</p>
            {brand.creci && <p className="text-xs text-ink-muted">{brand.creci}</p>}
          </div>
        </div>
        {site.whatsappUrl && <WhatsappLink href={site.whatsappUrl} label="WhatsApp" primary />}
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 pt-8 pb-16 sm:px-6">
        {featured ? (
          <>
            <Development dev={featured} featured />

            {featured.units.length > 0 && <UnitPicker dev={featured} />}

            {(featured.summary || featured.plans) && (
              <section aria-labelledby="sobre" className="flex flex-col gap-4">
                <h2 id="sobre" className="font-display text-[22px] font-extrabold uppercase">
                  O empreendimento
                </h2>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {featured.summary && (
                    <div className="rounded-lg border border-line bg-surface-raised p-4">
                      <dt className="text-xs font-semibold text-ink-muted">
                        Localização e entrega
                      </dt>
                      <dd className="mt-1">{featured.summary}</dd>
                    </div>
                  )}
                  {featured.plans && (
                    <div className="rounded-lg border border-line bg-surface-raised p-4">
                      <dt className="text-xs font-semibold text-ink-muted">Plantas</dt>
                      <dd className="mt-1">{featured.plans}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {site.others.length > 0 && (
              <section aria-labelledby="outros" className="flex flex-col gap-4">
                <h2 id="outros" className="font-display text-[22px] font-extrabold uppercase">
                  Outros empreendimentos
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {site.others.map((dev) => (
                    <Development key={dev.id} dev={dev} featured={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="font-display text-[32px] leading-9 font-extrabold uppercase">
            {site.empty}
          </p>
        )}

        {site.whatsappUrl && (
          <section
            aria-labelledby="contato"
            className="flex flex-col items-start gap-3 rounded-lg bg-brand p-6 text-on-brand"
          >
            <h2 id="contato" className="font-display text-[22px] font-extrabold uppercase">
              Fale com a {brand.name}
            </h2>
            <p>Tire dúvidas, simule o financiamento e agende sua visita pelo WhatsApp.</p>
            <a
              href={featured?.visitUrl ?? site.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} bg-surface-raised text-ink`}
            >
              Chamar no WhatsApp ↗
            </a>
          </section>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-ink-muted sm:px-6">
          {site.footer.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}
