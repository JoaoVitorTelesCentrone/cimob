import { describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry.ts";

describe("sentryOptions", () => {
  const options = sentryOptions({ dsn: "https://k@o1.ingest.sentry.io/1", environment: "staging" });

  it("não coleta usuário, cookie, corpo nem query, e não coleta traces", () => {
    expect(options).toMatchObject({
      dsn: "https://k@o1.ingest.sentry.io/1",
      environment: "staging",
      tracesSampleRate: 0,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpBodies: [],
        urlQueryParams: false,
        httpHeaders: { request: { allow: ["user-agent", "content-type"] }, response: false },
      },
    });
  });

  it("limpa telefone e corpo antes de enviar", () => {
    const event = options.beforeSend({
      message: "falha com 5511987654321",
      request: { data: { body: "Olá" } },
    });
    expect(event).toEqual({ message: "falha com [telefone]", request: {} });
  });

  it("limpa a mensagem dos breadcrumbs", () => {
    expect(options.beforeBreadcrumb({ message: "lead a@b.com", data: { x: 1 } })).toEqual({
      message: "lead [e-mail]",
    });
  });
});
