/**
 * O three.js atual (r187) desenha só em WebGL 2. Sem ele não adianta montar o Canvas: o site
 * mostra a grade 2D (T3.5). `webglAvailable` recebe a fábrica de contexto para ser testável sem
 * navegador; `browserHasWebgl` é a ligação com o DOM.
 */

export const WEBGL_CONTEXT = "webgl2";

export function webglAvailable(getContext: (kind: string) => unknown): boolean {
  try {
    return Boolean(getContext(WEBGL_CONTEXT));
  } catch {
    return false;
  }
}

export function browserHasWebgl(): boolean {
  if (typeof document === "undefined") return false;
  return webglAvailable((kind) => document.createElement("canvas").getContext(kind));
}
