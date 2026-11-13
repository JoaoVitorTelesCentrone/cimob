import { z } from "zod";
import {
  agentStats,
  byName,
  inPeriodOf,
  type AgentRow,
  type DashboardLead,
} from "./leads/dashboard";
import type { Member } from "./leads/queries";

export type Role = Member["role"];
/** `whatsapp` é opcional para os testes que não tratam dele. */
export type TeamMember = Member & { inRotation: boolean; whatsapp?: string | null };
export type TeamRow = AgentRow & {
  userId: string;
  roleLabel: string;
  inRotation: boolean;
  isNext: boolean;
  whatsapp: string | null;
};
export type Team = { rows: TeamRow[]; nextName: string | null; warning: string | null };

export const ROLE_LABEL: Record<Role, string> = {
  agency_admin: "Agência",
  org_admin: "Gestor",
  agent: "Corretor",
};

const TEAM_PERIOD = 30;

/** Equipe com desempenho dos últimos 30 dias. `nextUserId` vem do banco (next_in_rotation), fonte única da ordem. */
export function buildTeam(
  members: readonly TeamMember[],
  leads: readonly DashboardLead[],
  nextUserId: string | null,
  now: Date,
): Team {
  const inPeriod = inPeriodOf(leads, TEAM_PERIOD, now);
  const rows = members
    .map((m) => ({
      ...agentStats(m, inPeriod, leads, now),
      userId: m.userId,
      roleLabel: ROLE_LABEL[m.role],
      inRotation: m.inRotation,
      isNext: m.userId === nextUserId,
      whatsapp: m.whatsapp ?? null,
    }))
    .sort(byName);
  return {
    rows,
    nextName: rows.find((r) => r.isNext)?.name ?? null,
    warning: members.some((m) => m.inRotation)
      ? null
      : "Ninguém no rodízio: leads novos ficam sem dono até alguém entrar.",
  };
}

/** Gestor da imobiliária e agência mudam o rodízio e distribuem leads (o banco confere de novo). */
export const canManageTeam = (role: Role | null) => role === "org_admin" || role === "agency_admin";

const Toggle = z.object({
  userId: z.uuid(),
  inRotation: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export function parseRotationToggle(raw: unknown): z.infer<typeof Toggle> | null {
  const parsed = Toggle.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type ActionResult = { ok: boolean; message: string };

export function assignMessage(ownerId: string | null, members: readonly Member[]): ActionResult {
  if (!ownerId) {
    return { ok: false, message: "Ninguém no rodízio. Coloque alguém na Equipe e tente de novo." };
  }
  const name = members.find((m) => m.userId === ownerId)?.name ?? "um corretor";
  return { ok: true, message: `Lead atribuído a ${name}` };
}

export type WhatsappResult = { ok: true; whatsapp: string | null } | { ok: false; message: string };

/**
 * WhatsApp do corretor como o banco guarda: só dígitos, com DDI 55. Aceita o que o gestor digitar
 * ("(11) 91111-0000", "+55 11 ..."); vazio apaga. DDD de 11 a 99; número fixo (8) ou celular (9).
 */
export function parseWhatsapp(raw: string): WhatsappResult {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { ok: true, whatsapp: null };
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!/^55[1-9][1-9]\d{8,9}$/.test(full)) {
    return { ok: false, message: "Número inválido. Use DDD e número, ex.: (11) 91234-5678" };
  }
  return { ok: true, whatsapp: full };
}
