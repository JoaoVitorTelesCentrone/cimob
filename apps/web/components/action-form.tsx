"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/team";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** Formulário que chama uma Server Action e mostra o resultado abaixo do botão. */
export function ActionForm({
  action,
  submitLabel,
  label,
  children,
  className = "flex flex-col gap-3",
}: {
  action: Action;
  submitLabel: string;
  /** Nome acessível do formulário. */
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [result, run, pending] = useActionState(action, null);
  return (
    <form action={run} aria-label={label} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending}
          className="h-10 rounded-pill bg-brand px-5 text-sm font-semibold text-on-brand disabled:opacity-60"
        >
          {pending ? "Salvando..." : submitLabel}
        </button>
        {result && (
          <span role="status" className={`text-sm ${result.ok ? "text-ink-muted" : "text-danger"}`}>
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
