import { describe, expect, it } from "vitest";
import { createExtractor } from "./extract.ts";
import { createOpenRouterExtractor, DEFAULT_MODEL } from "./openrouter.ts";

describe("createOpenRouterExtractor", () => {
  it("monta o extrator sem chamar a rede (a chamada só acontece ao extrair)", () => {
    expect(typeof createOpenRouterExtractor({ apiKey: "sk-or-teste" })).toBe("function");
    expect(
      typeof createOpenRouterExtractor({ apiKey: "sk-or-teste", modelId: "x/y", timeoutMs: 100 }),
    ).toBe("function");
  });

  it("o padrão é DeepSeek (doc 01)", () => {
    expect(DEFAULT_MODEL).toMatch(/^deepseek\//);
  });
});

describe("opções", () => {
  it("lista de opções vazia falha com mensagem clara", async () => {
    const extract = createExtractor({ model: "qualquer/modelo" });
    await expect(
      extract({
        text: "oi",
        pending: null,
        unitCode: null,
        options: { goal: [], budget: [], timeframe: [] },
      }),
    ).rejects.toThrow(/opções vazia/);
  });
});
