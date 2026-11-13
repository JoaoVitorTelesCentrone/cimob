import { contrastRatio, parseHex } from "./color";

export type Brand = { brand: string; brandStrong: string; brandSoft: string; onBrand: string };

const ON_BRAND = "#FFFFFF";
const MIN_CONTRAST = 4.5;

type Hsl = readonly [h: number, s: number, l: number];

function toHsl(hex: string): Hsl {
  const [r, g, b] = parseHex(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function toHex([h, s, l]: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b]: [number, number, number] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const byte = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`.toUpperCase();
}

export function brandFromColor(hex: string): Brand {
  parseHex(hex);
  let color = hex.toUpperCase();
  const [h, s, l0] = toHsl(color);
  let l = l0;
  while (contrastRatio(color, ON_BRAND) < MIN_CONTRAST && l > 0) {
    l = Math.max(0, l - 0.01);
    color = toHex([h, s, l]);
  }
  const [, , lFinal] = toHsl(color);
  return {
    brand: color,
    brandStrong: toHex([h, s, Math.max(0, lFinal - 0.08)]),
    brandSoft: toHex([h, Math.min(s, 0.45), 0.93]),
    onBrand: ON_BRAND,
  };
}
