import { describe, expect, it } from "vitest";
import { decideOrganization } from "./org-choice";

const a = { id: "a", name: "Alfa" };
const h = { id: "h", name: "Horizonte" };

describe("decideOrganization", () => {
  it("sem organizações, avisa", () => {
    expect(decideOrganization([], null)).toEqual({
      kind: "none",
      message: "Você ainda não tem acesso a nenhuma imobiliária",
    });
  });

  it("com uma só, entra nela mesmo com preferência inválida", () => {
    expect(decideOrganization([h], "x")).toEqual({ kind: "enter", organization: h });
  });

  it("com várias, usa a preferida se o usuário ainda pertence a ela", () => {
    expect(decideOrganization([h, a], "a")).toEqual({ kind: "enter", organization: a });
  });

  it("com várias e preferência ausente ou perdida, pede escolha", () => {
    expect(decideOrganization([h, a], null)).toEqual({ kind: "choose", options: [h, a] });
    expect(decideOrganization([h, a], "x")).toEqual({ kind: "choose", options: [h, a] });
  });
});
