import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

const valid = {
  WHATSAPP_VERIFY_TOKEN: "tok-verifica-123",
  WHATSAPP_APP_SECRET: "segredo-do-app-da-meta",
  REDIS_URL: "redis://localhost:6379",
  DATABASE_URL: "postgresql://postgres:senha@db.local:5432/postgres",
};

describe("loadConfig", () => {
  it("lê as variáveis e usa a porta 8787 por padrão", () => {
    expect(loadConfig(valid)).toEqual({
      verifyToken: "tok-verifica-123",
      appSecret: "segredo-do-app-da-meta",
      redisUrl: "redis://localhost:6379",
      databaseUrl: "postgresql://postgres:senha@db.local:5432/postgres",
      port: 8787,
      logLevel: "info",
      graphApiVersion: "v26.0",
      graphApiBaseUrl: "https://graph.facebook.com",
      fallbackToken: null,
      telegram: null,
      llm: null,
      transcribeUrl: null,
      adsToken: null,
    });
  });

  it("gasto da Meta: token da Marketing API do ambiente é opcional", () => {
    expect(loadConfig({ ...valid, META_ADS_ACCESS_TOKEN: "EAAG-ads" }).adsToken).toBe("EAAG-ads");
  });

  it("transcrição: endereço do serviço opcional, só http ou https", () => {
    expect(loadConfig({ ...valid, TRANSCRIBE_URL: "http://transcribe:8000" }).transcribeUrl).toBe(
      "http://transcribe:8000",
    );
    expect(() => loadConfig({ ...valid, TRANSCRIBE_URL: "transcribe:8000" })).toThrow(
      /TRANSCRIBE_URL/,
    );
  });

  it("LLM: com a chave do OpenRouter liga a extração; o modelo é opcional", () => {
    expect(loadConfig({ ...valid, OPENROUTER_API_KEY: "sk-or-1" }).llm).toEqual({
      apiKey: "sk-or-1",
      model: null,
    });
    expect(
      loadConfig({ ...valid, OPENROUTER_API_KEY: "sk-or-1", OPENROUTER_MODEL: "deepseek/x" }).llm,
    ).toEqual({ apiKey: "sk-or-1", model: "deepseek/x" });
  });

  it("modelo sem chave é erro de configuração", () => {
    expect(() => loadConfig({ ...valid, OPENROUTER_MODEL: "deepseek/x" })).toThrow(/OPENROUTER/);
  });

  it("envio: versão da Graph API, token único e Telegram são opcionais", () => {
    expect(
      loadConfig({
        ...valid,
        GRAPH_API_VERSION: "v27.0",
        WHATSAPP_ACCESS_TOKEN: "EAAG-unico",
        TELEGRAM_BOT_TOKEN: "123:abc",
        TELEGRAM_CHAT_ID: "-100",
      }),
    ).toMatchObject({
      graphApiVersion: "v27.0",
      fallbackToken: "EAAG-unico",
      telegram: { botToken: "123:abc", chatId: "-100" },
    });
  });

  it("endereço da Graph API trocável (homologação), só http ou https e sem barra no fim", () => {
    expect(
      loadConfig({ ...valid, GRAPH_API_BASE_URL: "http://127.0.0.1:9999/" }).graphApiBaseUrl,
    ).toBe("http://127.0.0.1:9999");
    expect(() => loadConfig({ ...valid, GRAPH_API_BASE_URL: "ftp://x" })).toThrow(
      /GRAPH_API_BASE_URL/,
    );
  });

  it("Telegram pela metade é erro de configuração", () => {
    expect(() => loadConfig({ ...valid, TELEGRAM_BOT_TOKEN: "123:abc" })).toThrow(/TELEGRAM/);
  });

  it("versão da Graph API no formato vNN.N", () => {
    expect(() => loadConfig({ ...valid, GRAPH_API_VERSION: "26" })).toThrow(/GRAPH_API_VERSION/);
  });

  it("aceita porta e nível de log", () => {
    expect(loadConfig({ ...valid, PORT: "3000", LOG_LEVEL: "debug" })).toMatchObject({
      port: 3000,
      logLevel: "debug",
    });
  });

  it("falta de variável obrigatória diz qual é, sem mostrar valores", () => {
    expect(() => loadConfig({ ...valid, WHATSAPP_APP_SECRET: "" })).toThrow(/WHATSAPP_APP_SECRET/);
    expect(() => loadConfig({ ...valid, WHATSAPP_APP_SECRET: "" })).not.toThrow(/tok-verifica/);
  });

  it("recusa REDIS_URL que não é redis:// ou rediss://", () => {
    expect(() => loadConfig({ ...valid, REDIS_URL: "http://x" })).toThrow(/REDIS_URL/);
    expect(loadConfig({ ...valid, REDIS_URL: "rediss://h:6380" }).redisUrl).toBe("rediss://h:6380");
  });

  it("recusa DATABASE_URL que não é Postgres, sem mostrar a senha", () => {
    expect(() => loadConfig({ ...valid, DATABASE_URL: "mysql://u:segredo@h/db" })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => loadConfig({ ...valid, DATABASE_URL: "mysql://u:segredo@h/db" })).not.toThrow(
      /segredo/,
    );
  });

  it("recusa porta inválida", () => {
    expect(() => loadConfig({ ...valid, PORT: "abc" })).toThrow(/PORT/);
  });
});
