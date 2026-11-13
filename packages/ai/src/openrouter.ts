import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createExtractor, type Extractor } from "./extract.ts";

/** Modelo padrão (doc 01: DeepSeek via OpenRouter). Trocável por `OPENROUTER_MODEL`. */
export const DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash";

/** Extrator de produção: OpenRouter com a chave do servidor (nunca no cliente). */
export function createOpenRouterExtractor(opts: {
  apiKey: string;
  modelId?: string;
  timeoutMs?: number;
}): Extractor {
  const openrouter = createOpenRouter({ apiKey: opts.apiKey });
  return createExtractor({
    model: openrouter(opts.modelId ?? DEFAULT_MODEL),
    ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
  });
}
