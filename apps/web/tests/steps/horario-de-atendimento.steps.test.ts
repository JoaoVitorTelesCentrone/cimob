import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import type { BusinessHours } from "@c1imob/core";
import { buildDashboard, type DashboardLead } from "@/lib/leads/dashboard";
import { isLate } from "@/lib/leads/list";
import type { Member } from "@/lib/leads/queries";
import { parseBusinessHoursForm } from "@/lib/onboarding";

const feature = await loadFeature("../../features/crm/horario-de-atendimento.feature", {
  language: "pt",
});

const MEMBERS: Member[] = [
  { userId: "user-gestor", name: "Gestor", role: "org_admin" },
  { userId: "user-marina", name: "Marina Alves", role: "agent" },
];

/** Semana de 11/11/2026 (quarta) a 16/11/2026 (segunda), hora de Brasília. */
const DATES: Record<string, string> = {
  quarta: "2026-11-11",
  sexta: "2026-11-13",
  sábado: "2026-11-14",
  segunda: "2026-11-16",
};
/** "na sexta às 22:00" → instante em Brasília. */
const at = (text: string) => {
  const m = /^(?:na|no) (\S+) às (\d\d:\d\d)$/.exec(text);
  const day = m?.[1] ? DATES[m[1]] : undefined;
  if (!m || !day) throw new Error(`momento desconhecido: ${text}`);
  return new Date(`${day}T${m[2] ?? ""}:00-03:00`);
};
const WEEKDAYS: BusinessHours["days"] = [1, 2, 3, 4, 5];

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let hours: BusinessHours | null = null;
  let leads: DashboardLead[] = [];
  let now = new Date();
  let refusal: string | undefined;

  const assign = (name: string, owner: string, when: Date): DashboardLead => ({
    id: `lead-${name}`,
    name,
    phone: "5511900000001",
    stage: "new",
    source: null,
    qualified: true,
    ownerId: MEMBERS.find((m) => m.name === owner)?.userId ?? null,
    ownerName: owner,
    assignedAt: when,
    firstResponseAt: null,
    createdAt: when,
  });
  const lead = (name: string) => {
    const found = leads.find((l) => l.name === name);
    if (!found) throw new Error(`lead desconhecido: ${name}`);
    return found;
  };
  const weekHours = () => {
    hours = { days: WEEKDAYS, open: "09:00", close: "18:00" };
  };

  ScenarioOutline(
    "O atraso conta só o tempo dentro do horário",
    ({ Given, And, When, Then }, v) => {
      Given("a imobiliária atende de segunda a sexta, das 09:00 às 18:00", weekHours);
      And('o lead "Ana Ribeiro" atribuído a "Marina Alves" <atribuído>', () => {
        leads = [assign("Ana Ribeiro", "Marina Alves", at(v["atribuído"] as string))];
      });
      When("o gestor abre o painel <agora>", () => {
        now = at(v["agora"] as string);
      });
      Then('"Ana Ribeiro" <situação> atrasado', () => {
        expect(isLate(lead("Ana Ribeiro"), now, hours)).toBe(v["situação"] === "está");
      });
    },
  );

  Scenario("Fora do horário o painel não mostra alerta", ({ Given, And, When, Then }) => {
    Given("a imobiliária atende de segunda a sexta, das 09:00 às 18:00", weekHours);
    And(
      "o lead {string} atribuído a {string} na sexta às 22:00",
      (_ctx, name: string, owner: string) => {
        leads = [assign(name, owner, at("na sexta às 22:00"))];
      },
    );
    When("o gestor abre o painel no sábado às 15:00", () => {
      now = at("no sábado às 15:00");
    });
    Then("o painel não mostra alerta de atraso", () => {
      expect(buildDashboard(leads, MEMBERS, 30, now, [], hours).lateAlert).toBeNull();
    });
  });

  Scenario("Sem horário definido, conta o tempo corrido", ({ Given, And, When, Then }) => {
    Given("a imobiliária não definiu horário de atendimento", () => {
      hours = null;
    });
    And(
      "o lead {string} atribuído a {string} na sexta às 22:00",
      (_ctx, name: string, owner: string) => {
        leads = [assign(name, owner, at("na sexta às 22:00"))];
      },
    );
    When("o gestor abre o painel no sábado às 00:01", () => {
      now = at("no sábado às 00:01");
    });
    Then("{string} está atrasado", (_ctx, name: string) => {
      expect(isLate(lead(name), now, hours)).toBe(true);
    });
  });

  Scenario("Horário com fechamento antes da abertura é recusado", ({ When, Then }) => {
    When("o gestor tenta salvar o horário de segunda a sexta, das 18:00 às 09:00", () => {
      const r = parseBusinessHoursForm({
        days: ["1", "2", "3", "4", "5"],
        open: "18:00",
        close: "09:00",
      });
      refusal = r.ok ? undefined : r.message;
    });
    Then("o sistema recusa com {string}", (_ctx, message: string) => {
      expect(refusal).toBe(message);
    });
  });

  Scenario("Horário sem nenhum dia é recusado", ({ When, Then }) => {
    When("o gestor tenta salvar o horário sem nenhum dia, das 09:00 às 18:00", () => {
      const r = parseBusinessHoursForm({ days: [], open: "09:00", close: "18:00" });
      refusal = r.ok ? undefined : r.message;
    });
    Then("o sistema recusa com {string}", (_ctx, message: string) => {
      expect(refusal).toBe(message);
    });
  });
});
