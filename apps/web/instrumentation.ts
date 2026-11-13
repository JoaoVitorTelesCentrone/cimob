import * as Sentry from "@sentry/nextjs";
import { webSentryOptions } from "@/lib/sentry-options";

/** Sentry no servidor (Node e Edge). Sem SENTRY_DSN, não liga. */
export function register() {
  const o = webSentryOptions(process.env.SENTRY_DSN, process.env.SENTRY_ENVIRONMENT ?? "production");
  if (!o) return;
  Sentry.init({
    dsn: o.dsn,
    environment: o.environment,
    tracesSampleRate: o.tracesSampleRate,
    dataCollection: o.dataCollection,
    beforeSend: (event) => o.beforeSend(event as never),
    beforeBreadcrumb: (crumb) => o.beforeBreadcrumb({ ...crumb }) as typeof crumb,
  });
}

/** Erros de Server Components, rotas e Server Actions. Sem init, o Sentry descarta. */
export const onRequestError = Sentry.captureRequestError;
