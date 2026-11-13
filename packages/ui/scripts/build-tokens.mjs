// Gera src/tokens.css e src/tokens.generated.ts a partir de tokens/tokens.json (fonte: design system Center One).
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const t = JSON.parse(readFileSync(new URL("tokens/tokens.json", root), "utf8"));

const up = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : v);
const colors = t.color.tokens.map((c) => ({
  ...c,
  value: { light: up(c.value.light), dark: up(c.value.dark) },
}));
const light = Object.fromEntries(colors.map((c) => [`--${c.name}`, c.value.light]));
const dark = Object.fromEntries(colors.map((c) => [`--${c.name}`, c.value.dark]));
const shared = {
  "--font-display": t.type.families.display,
  "--font-sans": t.type.families.sans,
  ...Object.fromEntries(t.spacing.tokens.map((s) => [`--${s.name}`, s.value])),
  ...Object.fromEntries(t.radius.tokens.map((r) => [`--${r.name}`, r.value])),
  ...Object.fromEntries(t.shadow.tokens.map((s) => [`--${s.name}`, s.value])),
};

const block = (sel, vars) =>
  `${sel} {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")}\n}\n`;

const colorNames = colors.map((c) => c.name);
const theme = `@theme inline {\n${colorNames.map((n) => `  --color-${n}: var(--${n});`).join("\n")}\n  --font-display: var(--font-display);\n  --font-sans: var(--font-sans);\n${t.radius.tokens.map((r) => `  --${r.name}: var(--${r.name});`).join("\n")}\n}\n`;

const css =
  "/* GERADO por scripts/build-tokens.mjs. Não edite. */\n" +
  block(":root", { ...shared, ...light }) +
  block(':root[data-theme="dark"], .dark', dark) +
  theme;
writeFileSync(new URL("src/tokens.css", root), css);

const ts =
  "// GERADO por scripts/build-tokens.mjs. Não edite.\n" +
  `export const sharedVars: Record<string, string> = ${JSON.stringify(shared, null, 2)};\n` +
  `export const lightVars: Record<string, string> = ${JSON.stringify(light, null, 2)};\n` +
  `export const darkVars: Record<string, string> = ${JSON.stringify(dark, null, 2)};\n`;
writeFileSync(new URL("src/tokens.generated.ts", root), ts);
