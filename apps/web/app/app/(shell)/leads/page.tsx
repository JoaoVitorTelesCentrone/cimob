import { Suspense } from "react";
import { LeadsView } from "./_components/leads-view";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function LeadsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Carregando leads...</p>}>
      <LeadsView searchParams={searchParams} />
    </Suspense>
  );
}
