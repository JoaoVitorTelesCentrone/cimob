import { Suspense } from "react";
import { DashboardView } from "./_components/dashboard-view";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function PainelPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Carregando painel...</p>}>
      <DashboardView searchParams={searchParams} />
    </Suspense>
  );
}
