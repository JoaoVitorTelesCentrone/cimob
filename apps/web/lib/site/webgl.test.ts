import { describe, expect, it } from "vitest";
import { WEBGL_CONTEXT, webglAvailable } from "./webgl";

describe("webglAvailable", () => {
  it("pede WebGL 2, a única versão que o three.js atual desenha", () => {
    const asked: string[] = [];
    const ok = webglAvailable((kind) => {
      asked.push(kind);
      return {};
    });
    expect(ok).toBe(true);
    expect(asked).toEqual([WEBGL_CONTEXT]);
    expect(WEBGL_CONTEXT).toBe("webgl2");
  });

  it("sem contexto, o navegador não tem WebGL", () => {
    expect(webglAvailable(() => null)).toBe(false);
  });

  it("erro ao criar o contexto também cai no fallback", () => {
    expect(
      webglAvailable(() => {
        throw new Error("context lost");
      }),
    ).toBe(false);
  });
});
