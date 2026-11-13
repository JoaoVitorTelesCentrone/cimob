"use client";

import { useActionState } from "react";
import { formatPhone } from "@/lib/format";
import { setWhatsapp } from "./actions";

/** Campo do WhatsApp do corretor (recebe o resumo dos leads). Só aparece para o gestor. */
export function WhatsappForm({
  userId,
  name,
  whatsapp,
}: {
  userId: string;
  name: string;
  whatsapp: string | null;
}) {
  const [result, run, pending] = useActionState(setWhatsapp, null);
  return (
    <form action={run} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        name="whatsapp"
        aria-label={`WhatsApp de ${name}`}
        defaultValue={whatsapp ? formatPhone(whatsapp) : ""}
        placeholder="(11) 91234-5678"
        inputMode="tel"
        className="h-8 w-40 rounded-md border border-line bg-surface px-2 text-xs text-ink"
      />
      <button disabled={pending} className="text-xs font-semibold underline disabled:opacity-60">
        {pending ? "Salvando..." : "Salvar"}
      </button>
      {result && (
        <span role="status" className={`text-xs ${result.ok ? "text-ink-muted" : "text-danger"}`}>
          {result.message}
        </span>
      )}
    </form>
  );
}
