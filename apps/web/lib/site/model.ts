import { formatPrice, type UnitStatus } from "@/lib/inventory";
import { whatsappUrl } from "@/lib/leads/whatsapp";
import { unitCard, type UnitCard } from "./unit-card";

/**
 * Modelo do site público (T3.1). Tudo vem da ficha: sem preço não há "a partir de", sem WhatsApp
 * não há botão. O site nunca inventa número (regra 2 do AGENTS.md).
 */

export type SiteBrand = {
  name: string;
  creci: string | null;
  whatsapp: string | null;
  /** Logo no Storage; sem logo, o site mostra as iniciais. */
  logoUrl?: string | null;
};

export type SiteUnit = {
  code: string;
  /** Andar e posição no andar (o prédio 3D é montado por eles). */
  floor?: number | null;
  position?: string | null;
  bedrooms: number | null;
  areaM2: number | null;
  /** Vagas de garagem (0 = sem vaga; null = a ficha não diz). */
  parking?: number | null;
  /** Nome do objeto no modelo 3D do arquiteto. */
  meshName?: string | null;
  price: number | null;
  status: UnitStatus;
};

export type SiteDevelopment = {
  id: string;
  name: string;
  address: string | null;
  /** AAAA-MM-DD */
  deliveryDate: string | null;
  isDemo: boolean;
  /** GLB do arquiteto (Storage); sem ele, o prédio é montado pela ficha. */
  modelUrl?: string | null;
  /** Localização (o sol do 3D usa); sem ela, luz fixa. */
  lat?: number | null;
  lng?: number | null;
  units: SiteUnit[];
};

export type DevelopmentView = {
  id: string;
  name: string;
  summary: string;
  availability: string;
  fromPrice: string | null;
  plans: string | null;
  whatsappUrl: string | null;
  visitUrl: string | null;
  /** Unidades da ficha: o espelho de vendas monta prédio e cards com elas (e o status ao vivo). */
  units: SiteUnit[];
  /** WhatsApp da imobiliária (os cards chamam por ele). */
  contact: string | null;
  modelUrl: string | null;
  location: { lat: number; lng: number } | null;
};

export type BuildingUnit = {
  code: string;
  floor: number | null;
  position: string | null;
  meshName: string | null;
  status: UnitStatus;
};

/** Unidades para o prédio 3D (código, andar, posição, objeto do modelo e status). */
export const buildingOf = (units: readonly SiteUnit[]): BuildingUnit[] =>
  units.map((u) => ({
    code: u.code,
    floor: u.floor ?? null,
    position: u.position ?? null,
    meshName: u.meshName ?? null,
    status: u.status,
  }));

/** Card de cada unidade, para quando o visitante escolhe no prédio ou na lista. */
export const cardsOf = (dev: Pick<DevelopmentView, "name" | "contact" | "units">): UnitCard[] =>
  dev.units.map((u) => unitCard(u, { development: dev.name, whatsapp: dev.contact }));

export type Site = {
  featured: DevelopmentView | null;
  others: DevelopmentView[];
  empty: string | null;
  whatsappUrl: string | null;
  footer: string[];
  demoNotice: string | null;
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function deliveryLabel(date: string | null, now: Date): string | null {
  const m = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (!m) return null;
  const [, year = "", month = ""] = m;
  if (new Date(`${date ?? ""}T00:00:00-03:00`) <= now) return "Pronto para morar";
  return `Entrega ${MONTHS[Number(month) - 1] ?? ""}/${year}`;
}

const area = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** "2 e 3 dormitórios, de 58 a 120 m²", a partir das unidades da ficha. */
export function plansLabel(units: readonly SiteUnit[]): string | null {
  const rooms = [...new Set(units.flatMap((u) => (u.bedrooms ? [u.bedrooms] : [])))].sort(
    (a, b) => a - b,
  );
  const areas = units.flatMap((u) => (u.areaM2 ? [u.areaM2] : []));
  const parts: string[] = [];
  if (rooms.length > 0) {
    const list =
      rooms.length === 1
        ? String(rooms[0])
        : `${rooms.slice(0, -1).join(", ")} e ${String(rooms.at(-1))}`;
    parts.push(`${list} ${rooms.length === 1 && rooms[0] === 1 ? "dormitório" : "dormitórios"}`);
  }
  if (areas.length > 0) {
    const min = Math.min(...areas);
    const max = Math.max(...areas);
    parts.push(
      min === max ? `de ${area.format(min)} m²` : `de ${area.format(min)} a ${area.format(max)} m²`,
    );
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

export function availabilityLabel(count: number): string {
  if (count === 0) return "Nenhuma unidade disponível no momento";
  return count === 1 ? "1 unidade disponível" : `${String(count)} unidades disponíveis`;
}

function view(brand: SiteBrand, dev: SiteDevelopment, now: Date): DevelopmentView {
  const available = dev.units.filter((u) => u.status === "available");
  const prices = available.flatMap((u) => (u.price ? [u.price] : []));
  const link = (text: string) => (brand.whatsapp ? whatsappUrl(brand.whatsapp, text) : null);
  return {
    id: dev.id,
    name: dev.name,
    summary: [dev.address, deliveryLabel(dev.deliveryDate, now)].filter(Boolean).join(" · "),
    availability: availabilityLabel(available.length),
    fromPrice: prices.length > 0 ? `a partir de ${formatPrice(Math.min(...prices))}` : null,
    plans: plansLabel(dev.units),
    whatsappUrl: link(`Olá! Vi o site e quero saber mais sobre o ${dev.name}.`),
    visitUrl: link(`Olá! Quero agendar uma visita ao ${dev.name}.`),
    units: dev.units,
    contact: brand.whatsapp,
    modelUrl: dev.modelUrl ?? null,
    location:
      typeof dev.lat === "number" && typeof dev.lng === "number"
        ? { lat: dev.lat, lng: dev.lng }
        : null,
  };
}

export function buildSite(
  brand: SiteBrand,
  developments: readonly SiteDevelopment[],
  now: Date = new Date(),
): Site {
  const [first, ...rest] = developments.map((d) => view(brand, d, now));
  return {
    featured: first ?? null,
    others: rest,
    empty: first ? null : "Em breve, novos lançamentos",
    whatsappUrl: brand.whatsapp
      ? whatsappUrl(brand.whatsapp, `Olá! Vi o site da ${brand.name} e quero saber mais.`)
      : null,
    footer: [brand.creci ? `${brand.name} · ${brand.creci}` : brand.name, "Site por Center One"],
    demoNotice: developments.some((d) => d.isDemo)
      ? "Demonstração: imobiliária, empreendimento, preços e disponibilidade são fictícios."
      : null,
  };
}
