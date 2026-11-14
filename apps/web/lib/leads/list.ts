import { isStage, type Stage } from "./stages";

export type LeadRow = {
  id: string;
  name: string;
  phone: string;
  stage: Stage;
  ownerId: string | null;
  ownerName: string | null;
  assignedAt: Date | null;
  firstResponseAt: Date | null;
  createdAt: Date;
  /** Próximo passo combinado (ficha do lead). */
  nextStep?: string | null;
  nextStepAt?: Date | null;
};

export type ListParams = {
  q: string;
  stage: Stage | null;
  owner: string | null;
  late: boolean;
  sort: "recent" | "name";
};

const LATE_AFTER_MS = 2 * 60 * 60 * 1000;
const MAX_QUERY = 100;

/** Regra do doc 06: dono definido, sem 1ª resposta, atribuído há mais de 2 h, fora de ganho/perdido. */
export function isLate(lead: LeadRow, now: Date): boolean {
  if (!lead.ownerId || !lead.assignedAt || lead.firstResponseAt) return false;
  if (lead.stage === "won" || lead.stage === "lost") return false;
  return now.getTime() - lead.assignedAt.getTime() > LATE_AFTER_MS;
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lê os filtros do endereço; valor inválido vira o padrão. */
export function parseListParams(raw: RawParams): ListParams {
  const stage = first(raw["stage"]);
  const owner = first(raw["owner"]).trim();
  return {
    q: first(raw["q"]).trim().slice(0, MAX_QUERY),
    stage: isStage(stage) ? stage : null,
    owner: owner || null,
    late: first(raw["late"]) === "1",
    sort: first(raw["sort"]) === "name" ? "name" : "recent",
  };
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function matches(lead: LeadRow, q: string): boolean {
  if (!q) return true;
  if (fold(lead.name).includes(fold(q))) return true;
  const digits = q.replace(/\D/g, "");
  return digits.length > 0 && lead.phone.includes(digits);
}

/** Filtra e ordena: atrasados sempre no topo; depois por nome ou pelos mais recentes. */
export function applyList(leads: readonly LeadRow[], p: ListParams, now: Date): LeadRow[] {
  const byName = (a: LeadRow, b: LeadRow) => fold(a.name).localeCompare(fold(b.name), "pt-BR");
  const byRecent = (a: LeadRow, b: LeadRow) => b.createdAt.getTime() - a.createdAt.getTime();

  return leads
    .filter((l) => matches(l, p.q))
    .filter((l) => !p.stage || l.stage === p.stage)
    .filter((l) => !p.owner || l.ownerId === p.owner)
    .filter((l) => !p.late || isLate(l, now))
    .map((l) => ({ lead: l, late: isLate(l, now) }))
    .sort((a, b) => {
      if (a.late !== b.late) return a.late ? -1 : 1;
      return p.sort === "name" ? byName(a.lead, b.lead) : byRecent(a.lead, b.lead);
    })
    .map((x) => x.lead);
}
