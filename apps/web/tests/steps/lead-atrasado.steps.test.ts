import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { planMove, type MovePlan } from "@/lib/leads/board";
import { buildDashboard, type DashboardLead } from "@/lib/leads/dashboard";
import { firstResponseMinutes, recordFirstResponse } from "@/lib/leads/first-response";
import { applyList, isLate, parseListParams } from "@/lib/leads/list";
import type { Member } from "@/lib/leads/queries";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/leads/stages";

const feature = await loadFeature("../../features/crm/lead-atrasado.feature", { language: "pt" });

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-12T15:00:00-03:00");
const MEMBERS: Member[] = [
  { userId: "user-gestor", name: "Gestor", role: "org_admin" },
  { userId: "user-marina", name: "Marina Alves", role: "agent" },
];

/** "em atendimento" → "contacted" (o Gherkin fala a língua do CRM). */
const stageByLabel = (label: string): Stage => {
  const found = STAGES.find((s) => STAGE_LABEL[s].toLowerCase() === label.toLowerCase());
  if (!found) throw new Error(`estágio desconhecido: ${label}`);
  return found;
};

const makeLead = (name: string, owner: string, hoursAgo: number): DashboardLead => ({
  id: `lead-${name}`,
  name,
  phone: "5511900000001",
  stage: "new",
  source: null,
  qualified: true,
  ownerId: MEMBERS.find((m) => m.name === owner)?.userId ?? null,
  ownerName: owner,
  assignedAt: new Date(now.getTime() - hoursAgo * HOUR),
  firstResponseAt: null,
  createdAt: new Date(now.getTime() - hoursAgo * HOUR),
});

describeFeature(feature, ({ Scenario }) => {
  let leads: DashboardLead[] = [];
  let message: string | undefined;
  let plan: MovePlan;

  const lead = (name: string) => {
    const found = leads.find((l) => l.name === name);
    if (!found) throw new Error(`lead desconhecido: ${name}`);
    return found;
  };

  Scenario(
    "Lead atribuído há mais de 2 horas sem resposta aparece como atrasado",
    ({ Given, And, When, Then }) => {
      Given(
        "o lead {string} atribuído a {string} há {int} horas",
        (_ctx, name: string, owner: string, hours: number) => {
          leads = [makeLead("Bruno Lima", owner, 1), makeLead(name, owner, hours)];
        },
      );
      And("{string} ainda não respondeu", (_ctx, owner: string) => {
        expect(leads.every((l) => l.ownerName === owner && !l.firstResponseAt)).toBe(true);
      });
      When("o gestor abre o painel", () => {
        message = buildDashboard(leads, MEMBERS, 30, now).lateAlert?.message;
      });
      Then("o painel mostra o alerta {string}", (_ctx, text: string) => {
        expect(message?.startsWith(text)).toBe(true);
      });
      And("{string} aparece primeiro na lista de leads", (_ctx, name: string) => {
        expect(applyList(leads, parseListParams({}), now)[0]?.name).toBe(name);
      });
    },
  );

  Scenario("Resposta do corretor remove o alerta", ({ Given, When, Then, And }) => {
    Given("o lead {string} atrasado", (_ctx, name: string) => {
      leads = [makeLead(name, "Marina Alves", 3)];
      expect(isLate(lead(name), now)).toBe(true);
    });
    When(
      "{string} responde {string} à pergunta de estágio",
      // A leitura da resposta 1–5 é do bot (T2.5); aqui vale o efeito no lead: a 1ª resposta é registrada.
      (_ctx, owner: string) => {
        leads = leads.map((l) => (l.ownerName === owner ? recordFirstResponse(l, now) : l));
      },
    );
    Then("o lead deixa de estar atrasado", () => {
      expect(leads.some((l) => isLate(l, now))).toBe(false);
    });
    And("o tempo de primeira resposta é registrado", () => {
      expect(firstResponseMinutes(leads[0] ?? makeLead("?", "?", 0))).toBe(180);
    });
  });

  Scenario("Marcar como perdido exige motivo", ({ Given, When, Then, And }) => {
    Given("o lead {string} no estágio {string}", (_ctx, name: string, label: string) => {
      leads = [{ ...makeLead(name, "Marina Alves", 1), stage: stageByLabel(label) }];
    });
    When("o corretor move o lead para {string} sem informar motivo", (_ctx, label: string) => {
      const current = leads[0]?.stage ?? "new";
      plan = planMove({ current, expected: current, to: stageByLabel(label) });
    });
    Then("a mudança não é salva", () => {
      expect(plan.kind).toBe("error");
    });
    And("o sistema pede o motivo da perda", () => {
      expect(plan).toMatchObject({ needsReason: true, message: "Informe o motivo da perda" });
    });
  });
});
