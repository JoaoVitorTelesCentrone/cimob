import { brandFromColor } from "./brand";
import { darkVars, lightVars, sharedVars } from "./tokens.generated";

export type ThemeName = "light" | "dark";
export type CssVars = Record<string, string>;

export function baseVars(theme: ThemeName): CssVars {
  return { ...sharedVars, ...(theme === "dark" ? darkVars : lightVars) };
}

/** Variáveis white label: só os tokens `brand*` mudam por cliente. */
export function brandCssVars(hex: string): CssVars {
  const b = brandFromColor(hex);
  return {
    "--brand": b.brand,
    "--brand-strong": b.brandStrong,
    "--brand-soft": b.brandSoft,
    "--on-brand": b.onBrand,
  };
}

export function applyBrand(base: CssVars, hex: string): CssVars {
  return { ...base, ...brandCssVars(hex) };
}
