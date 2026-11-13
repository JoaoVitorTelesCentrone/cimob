import { formatArea, formatPrice, STATUS_LABEL, type UnitStatus } from "@/lib/inventory";
import { whatsappUrl } from "@/lib/leads/whatsapp";
import type { SiteUnit } from "./model";

/**
 * Card da unidade escolhida no espelho de vendas (T3.3). Tudo vem da ficha: campo vazio some do
 * card, nunca vira número inventado (regra 2). Preço só para unidade disponível; vendida ou
 * reservada oferece "Ver parecidas". O código no texto do WhatsApp é o que o bot reconhece.
 */
export type UnitCard = {
  code: string;
  title: string;
  status: UnitStatus;
  statusLabel: string;
  /** Código, área, dormitórios, vagas e andar (só os que existem na ficha). */
  facts: string[];
  price: string | null;
  action: { label: string; url: string } | null;
};

export const unitNumber = (code: string) => code.split("-").at(-1) || code;

export const floorLabel = (floor: number | null | undefined) =>
  floor === null || floor === undefined ? null : floor === 0 ? "Térreo" : `${String(floor)}º andar`;

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

const SITUATION: Record<UnitStatus, string> = {
  available: "disponível",
  reserved: "reservada",
  sold: "vendida",
};

export function unitCard(
  unit: SiteUnit,
  ctx: { development: string; whatsapp: string | null },
): UnitCard {
  const number = unitNumber(unit.code);
  const parking = unit.parking ?? null;
  const facts = [
    unit.code,
    unit.areaM2 ? formatArea(unit.areaM2) : null,
    unit.bedrooms ? plural(unit.bedrooms, "dormitório", "dormitórios") : null,
    parking === null ? null : parking === 0 ? "Sem vaga" : plural(parking, "vaga", "vagas"),
    floorLabel(unit.floor),
  ].filter((f): f is string => f !== null);

  const available = unit.status === "available";
  const text = available
    ? `Olá! Vi a unidade ${number} do ${ctx.development} no site e quero saber mais. Código: ${unit.code}`
    : `Olá! Vi que a unidade ${number} do ${ctx.development} está ${SITUATION[unit.status]}. Quero ver opções parecidas. Código: ${unit.code}`;

  return {
    code: unit.code,
    title: `Unidade ${number}`,
    status: unit.status,
    statusLabel: STATUS_LABEL[unit.status],
    facts,
    price: available && unit.price ? formatPrice(unit.price) : null,
    action: ctx.whatsapp
      ? { label: available ? "Quero essa" : "Ver parecidas", url: whatsappUrl(ctx.whatsapp, text) }
      : null,
  };
}
