import { describe, expect, it } from "vitest";
import { STAGES, STAGE_LABEL, isStage } from "./stages";

describe("estágios", () => {
  it("segue a ordem do funil do doc 03", () => {
    expect(STAGES).toEqual([
      "new",
      "qualified",
      "contacted",
      "visit_scheduled",
      "visit_done",
      "proposal",
      "won",
      "lost",
    ]);
  });

  it("todo estágio tem rótulo em português", () => {
    for (const s of STAGES) expect(STAGE_LABEL[s]).toMatch(/^[A-ZÀ-Ú]/);
  });

  it("isStage reconhece só estágios válidos", () => {
    expect(isStage("won")).toBe(true);
    expect(isStage("xyz")).toBe(false);
  });
});
