"use client";

import { useActionState, useRef } from "react";
import { STATUS_CLASS, STATUS_LABEL, UNIT_STATUSES, type UnitStatus } from "@/lib/inventory";
import { changeStatus } from "./actions";

/** Seletor de status que salva ao trocar. Só aparece para o gestor; o servidor confere de novo. */
export function StatusSelect({
  kind,
  id,
  status,
  label,
}: {
  kind: "unit" | "property";
  id: string;
  status: UnitStatus;
  label: string;
}) {
  const [result, run, pending] = useActionState(changeStatus, null);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={run} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expected" value={status} />
      <select
        name="to"
        aria-label={`Status de ${label}`}
        defaultValue={status}
        disabled={pending}
        onChange={() => form.current?.requestSubmit()}
        className={`h-8 rounded-pill border-0 px-3 text-xs font-extrabold ${STATUS_CLASS[status]}`}
      >
        {UNIT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {result && !result.ok && (
        <span role="status" className="text-xs text-danger">
          {result.message}
        </span>
      )}
    </form>
  );
}
