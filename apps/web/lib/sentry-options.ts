import { SENTRY_DATA_COLLECTION, scrubEvent, scrubText, type ScrubbableEvent } from "@c1imob/core";

type Crumb = { message?: string; data?: unknown; [key: string]: unknown };

/**
 * Opções do Sentry do web (servidor e navegador). Sem DSN, nulo: o Sentry não liga. Sem traces nem
 * replay; nada de usuário, cookie, corpo ou query; tudo passa pelo limpador antes de sair (LGPD).
 */
export function webSentryOptions(dsn: string | undefined, environment: string) {
  if (!dsn) return null;
  return {
    dsn,
    environment,
    tracesSampleRate: 0,
    dataCollection: SENTRY_DATA_COLLECTION,
    beforeSend: <T extends ScrubbableEvent>(event: T): T => scrubEvent(event),
    beforeBreadcrumb: (crumb: Crumb): Crumb => {
      const rest: Crumb = Object.fromEntries(Object.entries(crumb).filter(([k]) => k !== "data"));
      return crumb.message === undefined ? rest : { ...rest, message: scrubText(crumb.message) };
    },
  };
}
