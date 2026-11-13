import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UnitStatus } from "@/lib/inventory";
import { BuildingPreview } from "./building-preview";

const unit = (code: string, floor: number, status: UnitStatus) => ({
  code,
  floor,
  position: code.slice(-2),
  status,
});

describe("BuildingPreview", () => {
  it("entrega a imagem estática no HTML, com a fachada e as cores de status", () => {
    const html = renderToStaticMarkup(
      createElement(BuildingPreview, {
        units: [unit("AUR-401", 4, "sold"), unit("AUR-501", 5, "available")],
      }),
    );
    expect(html).toContain('data-building-preview="true"');
    expect(html).toContain('src="data:image/svg+xml,');
    expect(html).toContain("var(--available)");
    expect(html).toContain("var(--sold)");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('alt=""');
  });
});
