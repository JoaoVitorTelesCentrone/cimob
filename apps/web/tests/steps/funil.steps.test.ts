import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { buildBoard, planMove, type Board, type MovePlan } from "@/lib/leads/board";
import type { LeadRow } from "@/lib/leads/list";
import type { Stage } from "@/lib/leads/stages";

const feature = await loadFeature("../../features/crm/funil.feature", { language: "pt" });

const at = (text: string) => new Date(`${text.replace(" ", "T")}:00-03:00`);

describeFeature(feature, ({ Background, Scenario }) => {
  let now: Date;
  let leads: LeadRow[] = [];
  let board: Board = [];
  let plan: MovePlan;

  const lead = (name: string) => {
    const found = leads.find((l) => l.name === name);
    if (!found) throw new Error(`lead desconhecido: ${name}`);
    return found;
  };
  const column = (label: string) => {
    const found = board.find((c) => c.label === label);
    if (!found) throw new Error(`coluna desconhecida: ${label}`);
    return found;
  };
  const drag = (name: string, to: string, reason?: string) => {
    const current = lead(name).stage;
    plan = planMove({ current, expected: current, to, reason });
  };

  Background(({ Given, And }) => {
    Given("agora são {string}", (_ctx, text: string) => {
      now = at(text);
      board = [];
    });
    And("os leads do funil:", (_ctx, table: Record<string, string>[]) => {
      leads = table.map((row, i) => ({
        id: `lead-${String(i + 1)}`,
        name: row["nome"] ?? "",
        phone: `55119000000${String(i + 1)}`,
        stage: (row["estágio"] ?? "new") as Stage,
        ownerId: "user-marina",
        ownerName: "Marina",
        assignedAt: at(row["atribuído às"] ?? ""),
        firstResponseAt: row["respondido"] === "sim" ? now : null,
        createdAt: new Date(now.getTime() - i * 60_000),
      }));
    });
  });

  Scenario("As colunas seguem a ordem do funil e mostram a contagem", ({ When, Then, And }) => {
    When("abro o funil", () => {
      board = buildBoard(leads, now);
    });
    Then(
      "as colunas são {string}, {string}, {string}, {string}, {string}, {string}, {string}, {string}",
      (_ctx: unknown, ...labels: string[]) => {
        expect(board.map((c) => c.label)).toEqual(labels);
      },
    );
    And("a coluna {string} tem {int} leads", (_ctx, label: string, n: number) => {
      expect(column(label).leads).toHaveLength(n);
    });
    And("a coluna {string} tem {int} lead", (_ctx, label: string, n: number) => {
      expect(column(label).leads).toHaveLength(n);
    });
  });

  Scenario("Atrasados ficam no topo da coluna", ({ When, Then }) => {
    When("abro o funil", () => {
      board = buildBoard(leads, now);
    });
    Then("o primeiro da coluna {string} é {string}", (_ctx, label: string, name: string) => {
      expect(column(label).leads[0]?.name).toBe(name);
    });
  });

  Scenario("Mover para outra etapa é aceito", ({ When, Then }) => {
    When("arrasto {string} para {string}", (_ctx, name: string, to: string) => {
      drag(name, to);
    });
    Then("a mudança é aceita para {string}", (_ctx, to: string) => {
      expect(plan).toEqual({ kind: "move", to, lostReason: null });
    });
  });

  Scenario("Soltar na mesma coluna não muda nada", ({ When, Then }) => {
    When("arrasto {string} para {string}", (_ctx, name: string, to: string) => {
      drag(name, to);
    });
    Then("nada é salvo", () => {
      expect(plan).toEqual({ kind: "noop" });
    });
  });

  Scenario("Mover para perdido sem motivo pede o motivo", ({ When, Then, And }) => {
    When(
      "arrasto {string} para {string} sem informar o motivo",
      (_ctx, name: string, to: string) => {
        drag(name, to);
      },
    );
    Then("a mudança não é salva", () => {
      expect(plan.kind).toBe("error");
    });
    And("vejo a mensagem {string}", (_ctx, message: string) => {
      expect(plan).toEqual({ kind: "error", message, needsReason: true });
    });
  });

  Scenario("Mover para perdido com motivo é aceito", ({ When, Then }) => {
    When(
      "arrasto {string} para {string} com o motivo {string}",
      (_ctx, name: string, to: string, reason: string) => {
        drag(name, to, reason);
      },
    );
    Then(
      "a mudança é aceita para {string} com o motivo {string}",
      (_ctx, to: string, reason: string) => {
        expect(plan).toEqual({ kind: "move", to, lostReason: reason });
      },
    );
  });

  Scenario("Motivo longo demais é recusado", ({ When, Then }) => {
    When(
      "arrasto {string} para {string} com um motivo de {int} caracteres",
      (_ctx, name: string, to: string, size: number) => {
        drag(name, to, "x".repeat(size));
      },
    );
    Then("vejo a mensagem {string}", (_ctx, message: string) => {
      expect(plan).toMatchObject({ kind: "error", message });
    });
  });

  Scenario("Lead alterado por outra pessoa no meio do caminho", ({ Given, When, Then }) => {
    Given("outra pessoa já moveu {string} para {string}", (_ctx, name: string, stage: string) => {
      lead(name).stage = stage as Stage;
    });
    When(
      "arrasto {string} de {string} para {string}",
      (_ctx, name: string, from: string, to: string) => {
        plan = planMove({ current: lead(name).stage, expected: from, to });
      },
    );
    Then("vejo a mensagem {string}", (_ctx, message: string) => {
      expect(plan).toMatchObject({ kind: "error", message });
    });
  });

  Scenario("Etapa inexistente é recusada", ({ When, Then }) => {
    When("arrasto {string} para {string}", (_ctx, name: string, to: string) => {
      drag(name, to);
    });
    Then("vejo a mensagem {string}", (_ctx, message: string) => {
      expect(plan).toMatchObject({ kind: "error", message });
    });
  });
});
