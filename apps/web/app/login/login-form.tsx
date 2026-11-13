"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { requestMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle", message: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(requestMagicLink, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-xs font-semibold text-ink-muted">
        Seu e-mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="h-10 rounded-md border border-line bg-surface-raised px-3 text-ink"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Receber link de acesso"}
      </Button>
      {state.message && (
        <p role="status" className={state.status === "error" ? "text-danger" : "text-ink-muted"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
