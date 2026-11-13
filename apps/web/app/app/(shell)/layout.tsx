import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { MENU } from "@/lib/menu";
import { currentDecision } from "@/lib/org";
import { signOut } from "../actions";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-ink-muted">Carregando...</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const [decision, platform] = await Promise.all([currentDecision(), isPlatformAdmin()]);
  if (decision.kind !== "enter") redirect("/app/escolher");

  return (
    <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)] print:block">
      <aside className="flex flex-col gap-4 border-r border-line bg-surface-raised p-4 print:hidden">
        <div>
          <p className="text-xs font-semibold text-ink-muted">Imobiliária</p>
          <p className="font-display text-lg font-extrabold">{decision.organization.name}</p>
          <Link href="/app/escolher" className="text-xs text-ink-muted underline">
            Trocar imobiliária
          </Link>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 font-semibold hover:bg-brand-soft"
            >
              {item.label}
            </Link>
          ))}
          {platform && (
            <Link href="/app/agencia" className="rounded-md px-3 py-2 font-semibold hover:bg-brand-soft">
              Agência
            </Link>
          )}
        </nav>
        <form action={signOut} className="mt-auto">
          <button className="text-xs text-ink-muted underline">Sair</button>
        </form>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
