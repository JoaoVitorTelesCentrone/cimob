import { expect, vi } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import {
  buildInventory,
  formatUnit,
  parseStatusFilter,
  planStatusChange,
  STATUS_COLOR,
  type Inventory,
  type StatusPlan,
  type UnitRow,
  type UnitStatus,
} from "@/lib/inventory";
import { createRefreshScheduler, realtimeSubscriptions } from "@/lib/realtime";

const feature = await loadFeature("../../features/crm/imoveis.feature", { language: "pt" });

type TableRow = Record<string, string>;

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let units: UnitRow[] = [];
  let inventory: Inventory;
  let plan: StatusPlan;
  const changedByOthers = new Map<string, UnitStatus>();

  const group = (name: string) => {
    const found = inventory.find((g) => g.development === name);
    if (!found) throw new Error(`empreendimento desconhecido: ${name}`);
    return found;
  };
  const change = (code: string, from: string, to: string, canEdit: boolean) => {
    const current = changedByOthers.get(code) ?? units.find((u) => u.code === code)?.status;
    if (!current) throw new Error(`unidade desconhecida: ${code}`);
    plan = planStatusChange({ canEdit, current, expected: from, to });
  };

  Background(({ Given }) => {
    Given("as unidades do empreendimento {string}:", (_ctx, dev: string, table: TableRow[]) => {
      changedByOthers.clear();
      units = table.map((r, i) => ({
        id: `unit-${String(i + 1)}`,
        developmentName: dev,
        code: r["código"] ?? "",
        floor: Number(r["andar"]),
        areaM2: r["área"] ? Number(r["área"]) : null,
        bedrooms: Number(r["quartos"]),
        price: r["preço"] ? Number(r["preço"]) : null,
        status: (r["status"] ?? "available") as UnitStatus,
      }));
    });
  });

  Scenario(
    "Unidades em ordem de andar e código, com status em português",
    ({ When, Then, And }) => {
      When("abro os imóveis", () => {
        inventory = buildInventory(units, null);
      });
      Then("as unidades de {string} são:", (_ctx, dev: string, table: TableRow[]) => {
        expect(
          group(dev).units.map((u) => {
            const f = formatUnit(u);
            return {
              código: u.code,
              andar: f.floor,
              área: f.area,
              preço: f.price,
              status: f.status,
            };
          }),
        ).toEqual(table);
      });
      And("o resumo de {string} é {string}", (_ctx, dev: string, summary: string) => {
        expect(group(dev).summary).toBe(summary);
      });
    },
  );

  Scenario("Filtro por status", ({ When, Then }) => {
    When("filtro os imóveis pelo status {string}", (_ctx, status: string) => {
      inventory = buildInventory(units, parseStatusFilter(status));
    });
    Then("aparecem só {string} e {string}", (_ctx, a: string, b: string) => {
      expect(inventory.flatMap((g) => g.units.map((u) => u.code))).toEqual([a, b]);
    });
  });

  ScenarioOutline("As cores de status são fixas", ({ Then }, variables) => {
    Then('o status "<status>" usa a cor "<cor>"', () => {
      expect(STATUS_COLOR[variables["status"] as UnitStatus]).toBe(variables["cor"]);
    });
  });

  Scenario("Gestor muda o status", ({ When, Then }) => {
    When(
      "o gestor muda {string} de {string} para {string}",
      (_ctx, code: string, from: string, to: string) => {
        change(code, from, to, true);
      },
    );
    Then("a mudança de status é aceita para {string}", (_ctx, to: string) => {
      expect(plan).toEqual({ kind: "change", to });
    });
  });

  Scenario("Escolher o mesmo status não salva nada", ({ When, Then }) => {
    When(
      "o gestor muda {string} de {string} para {string}",
      (_ctx, code: string, from: string, to: string) => {
        change(code, from, to, true);
      },
    );
    Then("nada é salvo no estoque", () => {
      expect(plan).toEqual({ kind: "noop" });
    });
  });

  Scenario("Status inexistente é recusado", ({ When, Then }) => {
    When(
      "o gestor muda {string} de {string} para {string}",
      (_ctx, code: string, from: string, to: string) => {
        change(code, from, to, true);
      },
    );
    Then("vejo o erro de estoque {string}", (_ctx, message: string) => {
      expect(plan).toEqual({ kind: "error", message });
    });
  });

  Scenario("Corretor não muda o status", ({ When, Then }) => {
    When(
      "o corretor muda {string} de {string} para {string}",
      (_ctx, code: string, from: string, to: string) => {
        change(code, from, to, false);
      },
    );
    Then("vejo o erro de estoque {string}", (_ctx, message: string) => {
      expect(plan).toEqual({ kind: "error", message });
    });
  });

  Scenario("Unidade alterada por outra pessoa no meio do caminho", ({ Given, When, Then }) => {
    Given("outra pessoa já marcou {string} como {string}", (_ctx, code: string, status: string) => {
      changedByOthers.set(code, status as UnitStatus);
    });
    When(
      "o gestor muda {string} de {string} para {string}",
      (_ctx, code: string, from: string, to: string) => {
        change(code, from, to, true);
      },
    );
    Then("vejo o erro de estoque {string}", (_ctx, message: string) => {
      expect(plan).toEqual({ kind: "error", message });
    });
  });

  Scenario("Mudanças de outras pessoas atualizam a tela sozinhas", ({ Given, When, Then }) => {
    // Contador simples: o vitest-cucumber roda cada passo como um teste e o Vitest limpa os mocks entre eles.
    let refreshes = 0;
    const refresh = () => {
      refreshes += 1;
    };
    let scheduler: ReturnType<typeof createRefreshScheduler>;
    Given("a tela está aberta e escutando mudanças", () => {
      vi.useFakeTimers();
      scheduler = createRefreshScheduler(refresh);
    });
    When("chegam {int} mudanças em menos de {int} segundo", (_ctx, n: number, seconds: number) => {
      for (let i = 0; i < n; i++) {
        scheduler.notify();
        vi.advanceTimersByTime((seconds * 1000) / (n + 1));
      }
      vi.advanceTimersByTime(5000);
    });
    Then("a tela recarrega os dados {int} vez", (_ctx, times: number) => {
      vi.useRealTimers();
      expect(refreshes).toBe(times);
    });
  });

  Scenario("A tela só escuta a própria imobiliária", ({ When, Then }) => {
    let subs: ReturnType<typeof realtimeSubscriptions> = [];
    When("a tela de imóveis da imobiliária {string} começa a escutar", (_ctx, org: string) => {
      subs = realtimeSubscriptions(org, ["units", "properties"]);
    });
    Then(
      "ela escuta {string} e {string} filtrando {string}",
      (_ctx, a: string, b: string, filter: string) => {
        expect(subs).toEqual([
          { table: a, filter },
          { table: b, filter },
        ]);
      },
    );
  });
});
