import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button-variants";

describe("buttonVariants", () => {
  it("primário usa brand, pill e a seta ↗", () => {
    const cls = buttonVariants({ variant: "primary" });
    expect(cls).toContain("bg-brand");
    expect(cls).toContain("text-on-brand");
    expect(cls).toContain("rounded-pill");
    expect(cls).toContain("after:content-['↗']");
  });

  it("secundário não tem seta e usa a borda do design system", () => {
    const cls = buttonVariants({ variant: "secondary" });
    expect(cls).toContain("border-line");
    expect(cls).not.toContain("after:content");
  });

  it("perigo usa o token danger", () => {
    expect(buttonVariants({ variant: "danger" })).toContain("text-danger");
  });

  it("tamanho md tem 40px e sm tem 32px", () => {
    expect(buttonVariants({ size: "md" })).toContain("h-10");
    expect(buttonVariants({ size: "sm" })).toContain("h-8");
  });
});
