import { previewSrc, type FacadeUnit } from "@/lib/site/facade";

/**
 * Prévia estática do prédio (T3.5): uma imagem SVG embutida no HTML, pintada antes de o three.js
 * carregar. Fica por baixo do canvas (o 3D cobre quando monta) e serve de placeholder ao LCP.
 */
export function BuildingPreview({ units }: { units: readonly FacadeUnit[] }) {
  return (
    <img
      src={previewSrc(units)}
      alt=""
      aria-hidden="true"
      data-building-preview="true"
      loading="eager"
      decoding="async"
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
    />
  );
}
