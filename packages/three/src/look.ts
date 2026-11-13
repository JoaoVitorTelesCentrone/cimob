import { STATUS_COLORS, type UnitStatus } from "./layout";

export type UnitLook = {
  /** Cor do status (fixa, não segue a marca). */
  emissive: string;
  emissiveIntensity: number;
  opacity: number;
  dimmed: boolean;
};

/**
 * Aparência de uma unidade no 3D. À noite as janelas "acendem" (brilho maior); com "Só
 * disponíveis", as outras ficam apagadas e translúcidas, a não ser a que o visitante escolheu.
 */
export function unitLook(opts: {
  status: UnitStatus;
  highlighted: boolean;
  onlyAvailable: boolean;
  night: boolean;
}): UnitLook {
  const emissive = STATUS_COLORS[opts.status];
  const dimmed = opts.onlyAvailable && opts.status !== "available" && !opts.highlighted;
  if (dimmed) return { emissive, emissiveIntensity: 0.05, opacity: 0.3, dimmed };
  const base = opts.night ? 1.1 : 0.35;
  return {
    emissive,
    emissiveIntensity: opts.highlighted ? base + 0.55 : base,
    opacity: 1,
    dimmed,
  };
}
