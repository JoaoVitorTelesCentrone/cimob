import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { buildBoard } from "@/lib/leads/board";
import { isLate } from "@/lib/leads/list";
import { loadLeads, loadMembers } from "@/lib/leads/queries";
import { currentDecision } from "@/lib/org";
import { BoardClient, type ColumnData } from "./board-client";

export default function FunilPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">Funil</h1>
      <Suspense fallback={<p className="text-ink-muted">Carregando funil...</p>}>
        <Board />
      </Suspense>
    </div>
  );
}

async function Board() {
  const decision = await currentDecision();
  if (decision.kind !== "enter") redirect("/app/escolher");
  const orgId = decision.organization.id;

  const members = await loadMembers(orgId);
  const leads = await loadLeads(orgId, members);
  const now = new Date();

  const columns: ColumnData[] = buildBoard(leads, now).map((col) => ({
    stage: col.stage,
    label: col.label,
    cards: col.leads.map((l) => ({
      id: l.id,
      name: l.name,
      ownerName: l.ownerName,
      late: isLate(l, now),
      stage: l.stage,
    })),
  }));

  return (
    <>
      <RealtimeRefresh organizationId={orgId} tables={["leads"]} />
      <BoardClient columns={columns} />
    </>
  );
}
