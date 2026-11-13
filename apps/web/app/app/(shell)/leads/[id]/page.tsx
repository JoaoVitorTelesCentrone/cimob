import { Suspense } from "react";
import { LeadsView } from "../_components/leads-view";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function LeadPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Carregando leads...</p>}>
      <WithId params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function WithId({ params, searchParams }: Props) {
  const { id } = await params;
  return <LeadsView searchParams={searchParams} leadId={id} />;
}
