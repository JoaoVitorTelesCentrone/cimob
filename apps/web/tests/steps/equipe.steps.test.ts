import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import type { DashboardLead } from "@/lib/leads/dashboard";
import type { Stage } from "@/lib/leads/stages";
import {
  assignMessage,
  buildTeam,
  canManageTeam,
  parseRotationToggle,
  parseWhatsapp,
  type Team,
  type TeamMember,
} from "@/lib/team";

const feature = await loadFeature("../../features/crm/equipe.feature", { language: "pt" });

type TableRow = Record<string, string>;

const at = (text: string) => new Date(`${text.replace(" ", "T")}:00-03:00`);
const optionalAt = (text: string | undefined) => (text ? at(text) : null);
const yes = (v: boolean) => (v ? "sim" : "não");

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let now: Date;
  let members: TeamMember[] = [];
  let leads: DashboardLead[] = [];
  let team: Team;
  let message = "";
  let toggle: ReturnType<typeof parseRotationToggle>;

  const userId = (name: string) => `user-${name.toLowerCase()}`;

  Background(({ Given, And }) => {
    Given("agora são {string}", (_ctx, text: string) => {
      now = at(text);
    });
    And("a equipe:", (_ctx, table: TableRow[]) => {
      members = table.map((r) => ({
        userId: userId(r["nome"] ?? ""),
        name: r["nome"] ?? "",
        role: r["papel"] as TeamMember["role"],
        inRotation: r["rodízio"] === "sim",
      }));
    });
    And("os leads da equipe:", (_ctx, table: TableRow[]) => {
      leads = table.map((r, i) => ({
        id: `lead-${String(i + 1)}`,
        name: r["nome"] ?? "",
        phone: `55119000000${String(i + 1)}`,
        stage: (r["estágio"] ?? "new") as Stage,
        source: null,
        qualified: true,
        ownerId: userId(r["corretor"] ?? ""),
        ownerName: r["corretor"] ?? null,
        assignedAt: optionalAt(r["atribuído às"]),
        firstResponseAt: optionalAt(r["respondido às"]),
        createdAt: at(r["chegou em"] ?? ""),
      }));
    });
  });

  Scenario("A equipe mostra papel, rodízio e desempenho dos últimos 30 dias", ({ When, Then }) => {
    When("o gestor abre a equipe com {string} como próximo da vez", (_ctx, next: string) => {
      team = buildTeam(members, leads, userId(next), now);
    });
    Then("a equipe é:", (_ctx, table: TableRow[]) => {
      expect(
        team.rows.map((r) => ({
          nome: r.name,
          papel: r.roleLabel,
          rodízio: yes(r.inRotation),
          próximo: yes(r.isNext),
          leads: String(r.leads),
          "1ª resposta": r.firstResponse,
          visitas: String(r.visits),
          propostas: String(r.proposals),
          atrasados: String(r.late),
        })),
      ).toEqual(table);
    });
  });

  Scenario("Ninguém no rodízio gera aviso", ({ Given, When, Then }) => {
    Given("ninguém está no rodízio", () => {
      members = members.map((m) => ({ ...m, inRotation: false }));
    });
    When("o gestor abre a equipe sem próximo da vez", () => {
      team = buildTeam(members, leads, null, now);
    });
    Then("vejo o aviso {string}", (_ctx, text: string) => {
      expect(team.warning).toBe(text);
    });
  });

  ScenarioOutline("Só gestor muda o rodízio e distribui leads", ({ Then }, variables) => {
    Then('quem tem o papel "<papel>" <pode> mudar o rodízio e distribuir leads', () => {
      const role = variables["papel"] as TeamMember["role"];
      expect(canManageTeam(role)).toBe(variables["pode"] === "pode");
    });
  });

  Scenario("Pedido de mudança de rodízio inválido é recusado", ({ When, Then }) => {
    When("chega o pedido de rodízio {string}", (_ctx, query: string) => {
      const p = new URLSearchParams(query);
      toggle = parseRotationToggle({ userId: p.get("usuario"), inRotation: p.get("rodizio") });
    });
    Then("o pedido é recusado", () => {
      expect(toggle).toBeNull();
    });
  });

  Scenario("Distribuir pela ficha avisa quem recebeu", ({ When, Then }) => {
    When("o rodízio entrega o lead para {string}", (_ctx, name: string) => {
      message = assignMessage(userId(name), members).message;
    });
    Then("vejo a mensagem {string}", (_ctx, text: string) => {
      expect(message).toBe(text);
    });
  });

  Scenario("Distribuir sem ninguém no rodízio avisa o gestor", ({ When, Then }) => {
    When("o rodízio não encontra ninguém", () => {
      message = assignMessage(null, members).message;
    });
    Then("vejo a mensagem {string}", (_ctx, text: string) => {
      expect(message).toBe(text);
    });
  });

  ScenarioOutline(
    "WhatsApp do corretor é conferido antes de salvar",
    ({ When, Then }, variables) => {
      let saved: ReturnType<typeof parseWhatsapp>;
      When('o gestor informa o WhatsApp "<digitado>"', () => {
        saved = parseWhatsapp(String(variables["digitado"] ?? ""));
      });
      Then('o número salvo é "<salvo>"', () => {
        const typed = String(variables["salvo"]);
        const expected = typed === "nenhum" ? null : typed;
        expect(saved).toEqual({ ok: true, whatsapp: expected });
      });
    },
  );

  Scenario("WhatsApp inválido é recusado", ({ When, Then }) => {
    let result: ReturnType<typeof parseWhatsapp>;
    When("o gestor informa o WhatsApp {string}", (_ctx, text: string) => {
      result = parseWhatsapp(text);
    });
    Then("vejo o erro {string}", (_ctx, message: string) => {
      expect(result).toEqual({ ok: false, message });
    });
  });
});
