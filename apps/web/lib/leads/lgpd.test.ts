import { describe, expect, it } from "vitest";
import { exportFileName } from "./lgpd";

describe("exportFileName", () => {
  const now = new Date("2026-11-13T23:30:00-03:00");

  it("usa o nome do lead sem acento e a data de Brasília", () => {
    expect(exportFileName("Érica Nunes", now)).toBe("dados-lead-erica-nunes-2026-11-13.json");
  });

  it("tira o que não serve em nome de arquivo", () => {
    expect(exportFileName("  Ana / Ribeiro (2ª vez)  ", now)).toBe(
      "dados-lead-ana-ribeiro-2a-vez-2026-11-13.json",
    );
  });

  it("lead sem nome vira 'sem-nome'", () => {
    expect(exportFileName(null, now)).toBe("dados-lead-sem-nome-2026-11-13.json");
    expect(exportFileName("???", now)).toBe("dados-lead-sem-nome-2026-11-13.json");
  });
});
