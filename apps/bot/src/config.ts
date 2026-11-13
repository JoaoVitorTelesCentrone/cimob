import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));

const Env = z
  .object({
    WHATSAPP_VERIFY_TOKEN: z.string().min(1),
    WHATSAPP_APP_SECRET: z.string().min(1),
    REDIS_URL: z.string().regex(/^rediss?:\/\//, "use redis:// ou rediss://"),
    /** Conexão direta ao Postgres do Supabase (papel com acesso de sistema; o bot filtra por organização). */
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "use postgresql://"),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    GRAPH_API_VERSION: z
      .string()
      .regex(/^v\d+\.\d+$/, "use o formato v26.0")
      .default("v26.0"),
    /** Trocável para homologação (Graph API falsa); em produção fica o padrão. */
    GRAPH_API_BASE_URL: z
      .string()
      .regex(/^https?:\/\//, "use http:// ou https://")
      .default("https://graph.facebook.com")
      .transform((v) => v.replace(/\/+$/, "")),
    /** Token único da Cloud API para números sem token no Vault (enquanto a decisão 6 está aberta). */
    WHATSAPP_ACCESS_TOKEN: optional,
    /** Token da Marketing API para contas de anúncios sem token no Vault (gasto da Meta, T4.1). */
    META_ADS_ACCESS_TOKEN: optional,
    TELEGRAM_BOT_TOKEN: optional,
    TELEGRAM_CHAT_ID: optional,
    /** Extração com LLM (T2.4). Sem a chave, o bot entende só botões e palavras-chave. */
    OPENROUTER_API_KEY: optional,
    OPENROUTER_MODEL: optional,
    /** Serviço de transcrição (services/transcribe). Sem ele, áudio vira "pode escrever?". */
    TRANSCRIBE_URL: z
      .string()
      .regex(/^https?:\/\//, "use http:// ou https://")
      .optional()
      .transform((v) => v ?? null),
  })
  .refine((e) => (e.TELEGRAM_BOT_TOKEN === null) === (e.TELEGRAM_CHAT_ID === null), {
    message: "defina as duas ou nenhuma",
    path: ["TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID"],
  })
  .refine((e) => e.OPENROUTER_MODEL === null || e.OPENROUTER_API_KEY !== null, {
    message: "defina a chave junto com o modelo",
    path: ["OPENROUTER_API_KEY"],
  });

export type Config = {
  verifyToken: string;
  appSecret: string;
  redisUrl: string;
  databaseUrl: string;
  port: number;
  logLevel: z.infer<typeof Env>["LOG_LEVEL"];
  graphApiVersion: string;
  graphApiBaseUrl: string;
  fallbackToken: string | null;
  telegram: { botToken: string; chatId: string } | null;
  llm: { apiKey: string; model: string | null } | null;
  transcribeUrl: string | null;
  adsToken: string | null;
};

/** Lê a configuração do ambiente. O erro cita só os nomes das variáveis, nunca os valores. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new Error(`Configuração do bot inválida: ${names} (veja apps/bot/.env.example)`);
  }
  const e = parsed.data;
  return {
    verifyToken: e.WHATSAPP_VERIFY_TOKEN,
    appSecret: e.WHATSAPP_APP_SECRET,
    redisUrl: e.REDIS_URL,
    databaseUrl: e.DATABASE_URL,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    graphApiVersion: e.GRAPH_API_VERSION,
    graphApiBaseUrl: e.GRAPH_API_BASE_URL,
    fallbackToken: e.WHATSAPP_ACCESS_TOKEN,
    telegram:
      e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_CHAT_ID
        ? { botToken: e.TELEGRAM_BOT_TOKEN, chatId: e.TELEGRAM_CHAT_ID }
        : null,
    llm: e.OPENROUTER_API_KEY ? { apiKey: e.OPENROUTER_API_KEY, model: e.OPENROUTER_MODEL } : null,
    transcribeUrl: e.TRANSCRIBE_URL,
    adsToken: e.META_ADS_ACCESS_TOKEN,
  };
}
