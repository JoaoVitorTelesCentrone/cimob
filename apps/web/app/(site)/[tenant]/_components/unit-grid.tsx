import { STATUS_LABEL } from "@/lib/inventory";
import { floorRows, UNIT_FILL, UNIT_TEXT, type FacadeUnit } from "@/lib/site/facade";
import { unitNumber } from "@/lib/site/unit-card";

/**
 * Fallback 2D do espelho (T3.5): sem WebGL, a fachada vira uma grade por andar. As cores são as
 * fixas de status (regra 7) e cada célula abre o mesmo card da lista e do 3D.
 */
export function UnitGrid({
  units,
  selected,
  onlyAvailable,
  onSelect,
}: {
  units: readonly FacadeUnit[];
  selected: string | null;
  onlyAvailable: boolean;
  onSelect: (code: string) => void;
}) {
  const rows = floorRows(units);
  return (
    <div
      data-building-grid="2d"
      className="flex h-full flex-col justify-end overflow-auto p-3 text-ink sm:p-4"
    >
      <p className="mb-2 text-xs font-semibold text-ink-muted">
        Seu navegador não mostrou o 3D. Escolha pela grade:
      </p>
      <div role="list" aria-label="Unidades em 2D" className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div
            key={row.floor ?? "sem-andar"}
            role="listitem"
            className="flex items-center gap-2"
          >
            <span className="w-14 shrink-0 text-right text-[11px] text-ink-muted">
              {row.label}
            </span>
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
              {row.units.map((u) => {
                const isSelected = u.code === selected;
                const faded = onlyAvailable && u.status !== "available" && !isSelected;
                return (
                  <button
                    key={u.code}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Unidade ${unitNumber(u.code)}, ${STATUS_LABEL[u.status]}`}
                    data-status={u.status}
                    onClick={() => {
                      onSelect(u.code);
                    }}
                    style={{ backgroundColor: UNIT_FILL[u.status] }}
                    className={`h-8 min-w-8 flex-1 rounded-sm px-1 text-[11px] font-bold ${UNIT_TEXT[u.status]} ${
                      isSelected ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : ""
                    } ${faded ? "opacity-40" : ""}`}
                  >
                    {unitNumber(u.code)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
