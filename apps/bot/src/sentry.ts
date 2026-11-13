import * as Sentry from "@sentry/node";
import {
  SENTRY_DATA_COLLECTION,
  scrubEvent,
  scrubText,
  type ScrubbableEvent,
} from "@c1imob/core";

type Crumb = { message?: string; data?: unknown; [key: string]: unknown };

/** Opções do Sentry do bot: sem PII (LGPD), sem traces; tudo passa pelo limpador antes de sair. */
export function sentryOptions(cfg: { dsn: string; environment: string }) {
  return {
    dsn: cfg.dsn,
    environment: cfg.environment,
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampleRate: 0,
    beforeSend: <T extends ScrubbableEvent>(event: T): T => scrubEvent(event),
    beforeBreadcrumb: (crumb: Crumb): Crumb => {
      // Sem os dados soltos do breadcrumb (corpo de requisição, argumentos de log).
      const rest: Crumb = Object.fromEntries(Object.entries(crumb).filter(([k]) => k !== "data"));
      return crumb.message === undefined ? rest : { ...rest, message: scrubText(crumb.message) };
    },
  };
}

/** Liga o Sentry quando há DSN. Devolve quem registra erros e alertas (ou nada, sem DSN). */
export function initSentry(cfg: { dsn: string; environment: string } | null) {
  if (!cfg) return null;
  const o = sentryOptions(cfg);
  Sentry.init({
    dsn: o.dsn,
    environment: o.environment,
    dataCollection: o.dataCollection,
    tracesSampleRate: o.tracesSampleRate,
    beforeSend: (event) => o.beforeSend(event as unknown as ScrubbableEvent) as unknown as typeof event,
    beforeBreadcrumb: (crumb) => o.beforeBreadcrumb(crumb as Crumb) as typeof crumb,
  });
  return {
    error: (e: unknown) => Sentry.captureException(e),
    alert: (text: string) => Sentry.captureMessage(scrubText(text), "error"),
    flush: () => Sentry.flush(2_000),
  };
}
