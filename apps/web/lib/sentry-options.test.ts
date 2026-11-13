import { describe, expect, it } from "vitest";
import { webSentryOptions } from "./sentry-options";

describe("webSentryOptions", () => {
  it("sem DSN não liga o Sentry", () => {
    expect(webSentryOptions(undefined, "production")).toBeNull();
    expect(webSentryOptions("", "production")).toBeNull();
  });

  it("com DSN: sem traces, sem replay e sem dado pessoal", () => {
    const o = webSentryOptions("https://k@o1.ingest.sentry.io/2", "staging");
    expect(o).toMatchObject({
      dsn: "https://k@o1.ingest.sentry.io/2",
      environment: "staging",
      tracesSampleRate: 0,
      dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false },
    });
  });

  it("limpa telefone e e-mail do evento antes de enviar", () => {
    const o = webSentryOptions("https://k@o1.ingest.sentry.io/2", "production");
    expect(
      o?.beforeSend({ message: "lead 5511987654321 de a@b.com", user: { id: "u1", email: "a@b.com" } }),
    ).toEqual({ message: "lead [telefone] de [e-mail]", user: { id: "u1" } });
  });
});
