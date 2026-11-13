import { describe, expect, it } from "vitest";
import { mapModel } from "./model";

describe("mapModel", () => {
  it("o nome do objeto precisa bater exatamente (maiúsculas contam)", () => {
    const m = mapModel(
      ["aur-101"],
      [{ code: "AUR-101", meshName: "AUR-101", status: "available" }],
    );
    expect(m.byObject.size).toBe(0);
    expect(m.outside).toEqual(["AUR-101"]);
  });

  it("modelo vazio deixa todas as unidades fora", () => {
    expect(mapModel([], [{ code: "A", meshName: "A", status: "sold" }]).outside).toEqual(["A"]);
  });
});
