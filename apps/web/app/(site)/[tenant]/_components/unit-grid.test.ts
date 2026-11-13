import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UnitStatus } from "@/lib/inventory";
import { UnitGrid } from "./unit-grid";

type Unit = {
  code: string;
  floor: number | null;
  position: string | null;
  status: UnitStatus;
};

const unit = (
  code: string,
  floor: number | null,
  position: string | null,
  status: UnitStatus,
): Unit => ({ code, floor, position, status });

const UNITS: Unit[] = [
  unit("AUR-401", 4, "01", "sold"),
  unit("AUR-402", 4, "02", "reserved"),
  unit("AUR-501", 5, "01", "available"),
  unit("AUR-001", null, null, "available"),
];

const render = (selected: string | null = null, onlyAvailable = false) =>
  renderToStaticMarkup(
    createElement(UnitGrid, { units: UNITS, selected, onlyAvailable, onSelect: () => {} }),
  );

describe("UnitGrid", () => {
  it("mostra as unidades por andar, com o status de cada uma", () => {
    const html = render();
    expect(html).toContain('data-building-grid="2d"');
    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="Unidades em 2D"');
    expect(html).toContain("5º andar");
    expect(html).toContain("4º andar");
    expect(html).toContain("Outras unidades");
    expect(html).toContain('data-status="sold"');
    expect(html).toContain('data-status="reserved"');
    expect(html).toContain('aria-label="Unidade 402, Reservado"');
    expect(html).toContain('aria-label="Unidade 501, Disponível"');
  });

  it("marca a unidade escolhida e mantém as outras acessíveis", () => {
    const html = render("AUR-402");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("font-bold");
  });

  it("esmaece as indisponíveis quando o filtro está ligado", () => {
    expect(render(null, true)).toContain("opacity-40");
  });
});
