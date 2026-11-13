"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/team";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** Botão que chama uma Server Action e mostra o resultado ao lado. */
export function ActionButton({
  action,
  fields,
  label,
  className,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  className: string;
}) {
  const [result, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button disabled={pending} className={`${className} disabled:opacity-60`}>
        {pending ? "Salvando..." : label}
      </button>
      {result && (
        <span role="status" className={`text-xs ${result.ok ? "text-ink-muted" : "text-danger"}`}>
          {result.message}
        </span>
      )}
    </form>
  );
}
