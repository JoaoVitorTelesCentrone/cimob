import { describe, expect, it } from "vitest";
import { STAGE_CLASS } from "./stage-style";
import { STAGES } from "./stages";

describe("STAGE_CLASS", () => {
  it("todo estágio tem fundo e texto dos tokens do design system", () => {
    for (const s of STAGES) expect(STAGE_CLASS[s]).toMatch(/^bg-[a-z-]+-soft text-[a-z-]+$/);
  });

  it("ganho usa o verde de disponível e perdido o cinza de vendido", () => {
    expect(STAGE_CLASS.won).toBe("bg-available-soft text-available-ink");
    expect(STAGE_CLASS.lost).toBe("bg-sold-soft text-sold-ink");
  });
});
