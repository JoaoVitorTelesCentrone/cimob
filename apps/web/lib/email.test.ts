import { describe, expect, it } from "vitest";
import { parseEmail } from "./email";

describe("parseEmail", () => {
  it("normaliza espaços e maiúsculas", () => {
    expect(parseEmail("  Ana@Horizonte.com.br ")).toEqual({
      ok: true,
      email: "ana@horizonte.com.br",
    });
  });

  it.each(["", "   ", "ana", "ana@", "@x.com", "a b@x.com"])("recusa %j", (input) => {
    expect(parseEmail(input)).toEqual({ ok: false, message: "Informe um e-mail válido" });
  });
});
