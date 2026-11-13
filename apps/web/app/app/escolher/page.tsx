import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { isPlatformAdmin } from "@/lib/admin";
import { myOrganizations } from "@/lib/org";
import { decideOrganization } from "@/lib/org-choice";
import { selectOrganization, signOut } from "../actions";

export default function ChooseOrganizationPage() {
  return (
    <Suspense fallback={<p className="p-6 text-ink-muted">Carregando...</p>}>
      <ChooseOrganization />
    </Suspense>
  );
}

async function ChooseOrganization() {
  const [orgs, platform] = await Promise.all([myOrganizations(), isPlatformAdmin()]);
  // Quem tem uma só imobiliária não precisa escolher.
  const decision = decideOrganization(orgs, null);
  if (decision.kind === "enter") {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">Imobiliária</h1>
      {decision.kind === "none" ? (
        <p role="status">{decision.message}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {decision.options.map((o) => (
            <li key={o.id}>
              <form action={selectOrganization}>
                <input type="hidden" name="organizationId" value={o.id} />
                <Button variant="secondary" className="w-full justify-between">
                  {o.name}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {platform && (
        <Link href="/app/agencia" className="text-sm font-semibold underline">
          Agência: criar ou abrir imobiliária
        </Link>
      )}
      <form action={signOut}>
        <button className="text-xs text-ink-muted underline">Sair</button>
      </form>
    </main>
  );
}
