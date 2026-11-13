import type { Vec3 } from "./sun";

export const VIEW_NAMES = ["Aérea", "Frente", "Lateral", "Fundos", "Cobertura"] as const;
export type ViewName = (typeof VIEW_NAMES)[number];
export type ViewPreset = { position: Vec3; target: Vec3 };

/** Pedido de vista: `at` muda a cada clique, então repetir a mesma vista volta a enquadrar. */
export type ViewRequest = { name: ViewName; at: number };

export type Box = {
  width: number;
  depth: number;
  height: number;
  /** Centro da base do prédio (o modelo do arquiteto pode não estar na origem). */
  base?: Vec3;
};

/** Distância da câmera que enquadra o prédio inteiro (fov 38°). */
export const viewDistance = ({ width, depth, height }: Box) =>
  Math.max(45, height * 1.6, Math.max(width, depth) * 1.5);

/**
 * Vistas prontas, calculadas pelo tamanho do prédio (frente = +z). Servem para o prédio montado
 * pela ficha e para o modelo do arquiteto (pela caixa que envolve o modelo).
 */
export function viewPresets(box: Box): Record<ViewName, ViewPreset> {
  const [bx, by, bz] = box.base ?? [0, 0, 0];
  const h = box.height;
  const d = viewDistance(box);
  const at = (x: number, y: number, z: number): Vec3 => [bx + x, by + y, bz + z];
  const middle = at(0, h / 2, 0);
  // De frente, o prédio inteiro precisa caber na altura da tela (também no celular, em pé).
  const side = d * 1.45;
  return {
    Aérea: { position: at(d * 0.7, h * 0.8 + d * 0.25, d * 0.9), target: middle },
    Frente: { position: at(0, h * 0.45, side), target: middle },
    Lateral: { position: at(side, h * 0.45, 0), target: middle },
    Fundos: { position: at(0, h * 0.45, -side), target: middle },
    Cobertura: { position: at(d * 0.2, h + d * 0.7, d * 0.25), target: at(0, h * 0.85, 0) },
  };
}
