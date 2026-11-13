import { parseEmail } from "./email";
import { parseWhatsapp } from "./team";

/** Resultado de um formulário: valor pronto para o banco ou a mensagem para a pessoa. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
const fail = (message: string) => ({ ok: false, message }) as const;

/** Endereços que colidem com rotas da plataforma. Mesma lista de `create_organization` (migração 0023). */
export const RESERVED_SLUGS = new Set([
  "app", "login", "auth", "api", "www", "dev", "admin", "static", "assets", "site", "mail",
  "center-one", "c1imob",
]);
const SLUG = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;

/** "Lumen Imóveis & Cia." → "lumen-imoveis-cia" (até 40 caracteres). */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type NewOrg = { name: string; slug: string; adminName: string; adminEmail: string };

export function parseNewOrg(raw: Record<string, unknown>): Parsed<NewOrg> {
  const name = text(raw["name"]);
  if (!name) return fail("Informe o nome da imobiliária.");
  const slug = text(raw["slug"]) || slugify(name);
  if (!SLUG.test(slug)) return fail("Use só letras minúsculas, números e hífen no endereço.");
  if (RESERVED_SLUGS.has(slug)) return fail("Esse endereço é reservado. Escolha outro.");
  const adminName = text(raw["adminName"]);
  if (!adminName) return fail("Informe o nome do gestor.");
  const email = parseEmail(text(raw["adminEmail"]));
  if (!email.ok) return fail("Informe um e-mail válido para o gestor.");
  return { ok: true, value: { name, slug, adminName, adminEmail: email.email } };
}

export type Invite = { name: string; email: string; whatsapp: string | null };

export function parseInvite(raw: Record<string, unknown>): Parsed<Invite> {
  const name = text(raw["name"]);
  if (!name) return fail("Informe o nome.");
  const email = parseEmail(text(raw["email"]));
  if (!email.ok) return fail(email.message);
  const whatsapp = parseWhatsapp(text(raw["whatsapp"]));
  if (!whatsapp.ok) return fail(whatsapp.message);
  return { ok: true, value: { name, email: email.email, whatsapp: whatsapp.whatsapp } };
}

/** Campos da marca que o gestor edita. `null` tira o campo (o site não mostra o que não existe). */
export type BrandPatch = {
  color: string;
  creci: string | null;
  whatsapp: string | null;
  privacyUrl: string | null;
};

export function parseBrand(raw: Record<string, unknown>): Parsed<BrandPatch> {
  const color = text(raw["color"]).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) return fail("Escolha uma cor válida (ex.: #155F4B).");
  const creci = text(raw["creci"]);
  if (creci.length > 40) return fail("O CRECI tem no máximo 40 caracteres.");
  const whatsapp = parseWhatsapp(text(raw["whatsapp"]));
  if (!whatsapp.ok) return fail(whatsapp.message);
  const privacy = text(raw["privacyUrl"]);
  if (privacy && !URL.canParse(privacy)) return fail("O link do aviso de privacidade é inválido.");
  if (privacy && new URL(privacy).protocol !== "https:") {
    return fail("O link do aviso de privacidade precisa começar com https://");
  }
  return {
    ok: true,
    value: { color, creci: creci || null, whatsapp: whatsapp.whatsapp, privacyUrl: privacy || null },
  };
}

/** Valores atuais da marca para preencher o formulário. */
export function brandForm(brand: Record<string, unknown>): Record<keyof BrandPatch, string> {
  const str = (k: string) => (typeof brand[k] === "string" ? (brand[k]) : "");
  return {
    color: str("color") || "#155F4B",
    creci: str("creci"),
    whatsapp: str("whatsapp"),
    privacyUrl: str("privacyUrl"),
  };
}

export const TIMEFRAMES = [
  { value: "3m", label: "Até 3 meses" },
  { value: "6m", label: "Até 6 meses (padrão)" },
  { value: "any", label: "Qualquer prazo" },
] as const;
export type CriteriaTimeframe = (typeof TIMEFRAMES)[number]["value"];

export function parseCriteria(
  raw: Record<string, unknown>,
): Parsed<{ qualify_timeframe: CriteriaTimeframe; qualify_price_share: number }> {
  const timeframe = TIMEFRAMES.find((t) => t.value === raw["timeframe"])?.value;
  if (!timeframe) return fail("Escolha o prazo máximo.");
  const share = Number(text(raw["priceShare"]));
  if (!Number.isInteger(share) || share < 50 || share > 100) {
    return fail("A faixa deve cobrir de 50% a 100% do preço.");
  }
  return { ok: true, value: { qualify_timeframe: timeframe, qualify_price_share: share / 100 } };
}

export function criteriaForm(timeframe: string, priceShare: string | number) {
  return { timeframe, priceShare: Math.round(Number(priceShare) * 100) };
}

export function parsePhoneNumberId(raw: string): Parsed<string> {
  const value = raw.trim();
  return /^\d{6,20}$/.test(value)
    ? { ok: true, value }
    : fail("O Phone Number ID da Meta tem só números.");
}

export function parseAdsAccount(raw: string): Parsed<string> {
  const digits = raw.trim().replace(/^act_/, "");
  return /^\d{1,20}$/.test(digits)
    ? { ok: true, value: `act_${digits}` }
    : fail("A conta de anúncios é act_ seguido de números.");
}
