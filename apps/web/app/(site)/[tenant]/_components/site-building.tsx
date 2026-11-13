"use client";

import dynamic from "next/dynamic";
import type { ViewerUnit, ViewRequest } from "@c1imob/three";
import { BuildingPreview } from "./building-preview";
import { UnitGrid } from "./unit-grid";

/** O 3D (three.js) só carrega no navegador e depois do resto da página (doc 05). */
const BuildingViewer = dynamic(() => import("@c1imob/three").then((m) => m.BuildingViewer), {
  ssr: false,
  // A prévia estática já está pintada por baixo; nada de texto piscando no lugar do prédio.
  loading: () => null,
});

export type BuildingMode = "unknown" | "3d" | "2d";

/**
 * Área do prédio: prévia estática no HTML, 3D quando o navegador tem WebGL e grade 2D quando não
 * tem (T3.5). O modo é decidido no navegador (nunca no render do servidor).
 */
export function SiteBuilding({
  name,
  units,
  modelUrl,
  location,
  date,
  view,
  onlyAvailable,
  selected,
  mode,
  onSelect,
}: {
  name: string;
  units: ViewerUnit[];
  modelUrl: string | null;
  location: { lat: number; lng: number } | null;
  date: Date | null;
  view: ViewRequest | null;
  onlyAvailable: boolean;
  selected: string | null;
  mode: BuildingMode;
  onSelect: (code: string) => void;
}) {
  return (
    <div className="relative h-[420px] overflow-hidden rounded-lg border border-line bg-[#9CC9EA] sm:h-[520px]">
      <BuildingPreview units={units} />
      {mode === "3d" && (
        <BuildingViewer
          units={units}
          modelUrl={modelUrl}
          location={location}
          date={date}
          view={view}
          onlyAvailable={onlyAvailable}
          selected={selected}
          onSelect={onSelect}
          className="relative h-full w-full"
          label={`Prédio em 3D do ${name}: arraste para girar e toque numa unidade para ver os dados`}
        />
      )}
      {mode === "2d" && (
        <div className="absolute inset-0 bg-surface-sunken/95">
          <UnitGrid
            units={units}
            selected={selected}
            onlyAvailable={onlyAvailable}
            onSelect={onSelect}
          />
        </div>
      )}
    </div>
  );
}
