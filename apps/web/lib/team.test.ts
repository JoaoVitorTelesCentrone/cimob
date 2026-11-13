import { describe, expect, it } from "vitest";
import {
  assignMessage,
  buildTeam,
  canManageTeam,
  parseRotationToggle,
  parseWhatsapp,
  ROLE_LABEL,
} from "./team";
import type { TeamMember } from "./team";

const now = new Date("2026-11-12T15:00:00-03:00");
const uuid = "6f1c2a7e-3b9d-4c1e-9a55-0d2b7c4e8f10";

const members: TeamMember[] = [
  { userId: "u-sofia", name: "Sofia", role: "agent", inRotation: false },
  { userId: "u-ana", name: "Ana", role: "agent", inRotation: true },
];

describe("buildTeam", () => {
  it("lista todos os membros ativos em ordem de nome, com o próximo da vez marcado", () => {
    const team = buildTeam(members, [], "u-ana", now);
    expect(team.rows.map((r) => [r.name, r.isNext])).toEqual([
      ["Ana", true],
      ["Sofia", false],
    ]);
    expect(team.nextName).toBe("Ana");
    expect(team.warning).toBeNull();
  });

  it("avisa quando ninguém está no rodízio", () => {
    const team = buildTeam(
      members.map((m) => ({ ...m, inRotation: false })),
      [],
      null,
      now,
    );
    expect(team.warning).toMatch(/^Ninguém no rodízio/);
    expect(team.nextName).toBeNull();
  });
});

describe("ROLE_LABEL e canManageTeam", () => {
  it("traduz os papéis", () => {
    expect(ROLE_LABEL).toEqual({ agency_admin: "Agência", org_admin: "Gestor", agent: "Corretor" });
  });

  it("só gestor e agência gerenciam; papel desconhecido não", () => {
    expect(canManageTeam("org_admin")).toBe(true);
    expect(canManageTeam("agency_admin")).toBe(true);
    expect(canManageTeam("agent")).toBe(false);
    expect(canManageTeam(null)).toBe(false);
  });
});

describe("parseRotationToggle", () => {
  it("aceita um usuário válido e 'true'/'false'", () => {
    expect(parseRotationToggle({ userId: uuid, inRotation: "true" })).toEqual({
      userId: uuid,
      inRotation: true,
    });
    expect(parseRotationToggle({ userId: uuid, inRotation: "false" })?.inRotation).toBe(false);
  });

  it("recusa id inválido ou valor fora de true/false", () => {
    expect(parseRotationToggle({ userId: "xyz", inRotation: "true" })).toBeNull();
    expect(parseRotationToggle({ userId: uuid, inRotation: "talvez" })).toBeNull();
    expect(parseRotationToggle(null)).toBeNull();
  });
});

describe("assignMessage", () => {
  it("diz quem recebeu", () => {
    expect(assignMessage("u-ana", members)).toEqual({ ok: true, message: "Lead atribuído a Ana" });
  });

  it("usa um nome genérico se o membro não estiver na lista", () => {
    expect(assignMessage("u-x", members).message).toBe("Lead atribuído a um corretor");
  });

  it("avisa quando ninguém recebeu", () => {
    expect(assignMessage(null, members).ok).toBe(false);
  });
});

describe("parseWhatsapp", () => {
  it("só dígitos com DDI 55; sem DDI, assume Brasil", () => {
    expect(parseWhatsapp("5511911110000")).toEqual({ ok: true, whatsapp: "5511911110000" });
    expect(parseWhatsapp("21 99999-0000")).toEqual({ ok: true, whatsapp: "5521999990000" });
  });

  it("vazio apaga o número", () => {
    expect(parseWhatsapp("   ")).toEqual({ ok: true, whatsapp: null });
  });

  it("recusa número curto, longo ou com DDD inválido", () => {
    expect(parseWhatsapp("123").ok).toBe(false);
    expect(parseWhatsapp("55119111100001234").ok).toBe(false);
    expect(parseWhatsapp("(01) 91111-0000").ok).toBe(false);
  });
});
