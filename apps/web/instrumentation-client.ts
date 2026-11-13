import { webSentryOptions } from "@/lib/sentry-options";

/**
 * Sentry no navegador, só com NEXT_PUBLIC_SENTRY_DSN. O SDK é carregado sob demanda: sem DSN, o
 * site público (e o 3D no celular) não paga o peso dele.
 */
const o = webSentryOptions(
  process.env.NEXT_PUBLIC_SENTRY_DSN,
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
);
if (o) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: o.dsn,
      environment: o.environment,
      tracesSampleRate: o.tracesSampleRate,
      dataCollection: o.dataCollection,
      beforeSend: (event) => o.beforeSend(event as never),
      beforeBreadcrumb: (crumb) => o.beforeBreadcrumb({ ...crumb }) as typeof crumb,
    });
  });
}
