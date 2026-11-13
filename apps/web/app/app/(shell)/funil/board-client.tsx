"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { STAGE_CLASS } from "@/lib/leads/stage-style";
import { STAGE_LABEL, type Stage } from "@/lib/leads/stages";
import { moveLead } from "./actions";

export type Card = {
  id: string;
  name: string;
  ownerName: string | null;
  late: boolean;
  stage: Stage;
};
export type ColumnData = { stage: Stage; label: string; cards: Card[] };

type Pending = { card: Card; to: Stage };

export function BoardClient({ columns }: { columns: ColumnData[] }) {
  const [cards, setCards] = useState<Card[]>(() => columns.flatMap((c) => c.cards));
  // Dados novos do servidor (Realtime ou depois de salvar) substituem o estado local, sem remontar o quadro.
  const [source, setSource] = useState(columns);
  if (source !== columns) {
    setSource(columns);
    setCards(columns.flatMap((c) => c.cards));
  }
  const [message, setMessage] = useState<string | null>(null);
  const [askReason, setAskReason] = useState<Pending | null>(null);
  const [isPending, startTransition] = useTransition();
  // id estável entre servidor e cliente (evita erro de hidratação nos ids de acessibilidade do dnd-kit).
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const save = (card: Card, to: Stage, reason?: string) => {
    const before = cards;
    setCards((all) => all.map((c) => (c.id === card.id ? { ...c, stage: to } : c)));
    setMessage(null);
    startTransition(async () => {
      const result = await moveLead({ leadId: card.id, expected: card.stage, to, reason });
      if (!result.ok) {
        setCards(before);
        if (result.needsReason) setAskReason({ card, to });
        setMessage(result.message);
      } else {
        setAskReason(null);
      }
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const card = cards.find((c) => c.id === event.active.id);
    const to = event.over?.id as Stage | undefined;
    if (!card || !to || to === card.stage) return;
    if (to === "lost") {
      setMessage(null);
      setAskReason({ card, to });
      return;
    }
    save(card, to);
  };

  return (
    <>
      {message && !askReason && (
        <p
          role="alert"
          className="rounded-md bg-danger-soft px-4 py-2 text-sm font-semibold text-danger"
        >
          {message}
        </p>
      )}
      <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" aria-busy={isPending}>
          {columns.map((col) => (
            <Column
              key={col.stage}
              stage={col.stage}
              label={col.label}
              cards={cards.filter((c) => c.stage === col.stage)}
            />
          ))}
        </div>
      </DndContext>
      {askReason && (
        <ReasonDialog
          pending={askReason}
          busy={isPending}
          error={message}
          onCancel={() => {
            setAskReason(null);
            setMessage(null);
          }}
          onConfirm={(reason) => {
            save(askReason.card, askReason.to, reason);
          }}
        />
      )}
    </>
  );
}

function Column({ stage, label, cards }: { stage: Stage; label: string; cards: Card[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}: ${String(cards.length)} leads`}
      className={`flex w-64 shrink-0 flex-col gap-3 rounded-lg bg-surface-sunken p-3 ${isOver ? "ring-2 ring-brand" : ""}`}
    >
      <header className="flex items-center justify-between">
        <span
          className={`rounded-pill px-2 py-0.5 text-[11.5px] font-extrabold ${STAGE_CLASS[stage]}`}
        >
          {label}
        </span>
        <span className="text-xs font-semibold text-ink-muted tabular-nums">{cards.length}</span>
      </header>
      {cards.map((card) => (
        <LeadCard key={card.id} card={card} />
      ))}
    </section>
  );
}

function LeadCard({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  const style = transform
    ? { transform: `translate3d(${String(transform.x)}px, ${String(transform.y)}px, 0)` }
    : undefined;
  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      aria-roledescription="lead arrastável"
      className={`cursor-grab rounded-md border border-line bg-surface-raised p-3 shadow-[var(--shadow-card)] ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 font-extrabold">
        <Link href={`/app/leads/${card.id}`} className="hover:underline">
          {card.name}
        </Link>
        {card.late && (
          <span className="rounded-pill bg-danger-soft px-2 py-0.5 text-[11.5px] font-extrabold text-danger">
            Atrasado
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-muted">{card.ownerName ?? "Sem corretor"}</p>
    </article>
  );
}

function ReasonDialog({
  pending,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-title"
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-surface-raised p-5 shadow-[var(--shadow-overlay)]"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason);
        }}
      >
        <h2 id="reason-title" className="font-display text-[22px] leading-7 font-extrabold">
          Marcar como {STAGE_LABEL[pending.to].toLowerCase()}
        </h2>
        <p className="text-sm text-ink-muted">Por que {pending.card.name} foi perdido?</p>
        <label htmlFor="lost-reason" className="text-xs font-semibold text-ink-muted">
          Motivo da perda
        </label>
        <textarea
          id="lost-reason"
          autoFocus
          maxLength={300}
          rows={3}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "lost-reason-error" : undefined}
          className="rounded-md border border-line bg-surface p-3 text-sm text-ink"
        />
        {error && (
          <p id="lost-reason-error" role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
