import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { createWatchdog, type QueueProbe, type QueueStats } from "../../src/watchdog.ts";

const feature = await loadFeature("../../features/bot/vigia-das-filas.feature", { language: "pt" });

const NOW = Date.parse("2026-11-13T15:00:00-03:00");
const NAMES = ["inbound", "outbound", "transcribe"];

/** Sondas falsas: o cenário diz o estado de cada fila. */
class FakeQueues {
  readonly stats = new Map<string, QueueStats>();
  down = false;

  set(name: string, patch: Partial<QueueStats>) {
    const current = this.stats.get(name) ?? { oldestWaitingAt: null, failed: 0 };
    this.stats.set(name, { ...current, ...patch });
  }

  probes(): QueueProbe[] {
    return NAMES.map((name) => ({
      name,
      stats: () =>
        this.down
          ? Promise.reject(new Error("connect ECONNREFUSED"))
          : Promise.resolve(this.stats.get(name) ?? { oldestWaitingAt: null, failed: 0 }),
    }));
  }
}

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  let queues = new FakeQueues();
  let alerts: string[] = [];
  let watchdog = createWatchdog({ probes: [], alert: () => Promise.resolve() });

  BeforeEachScenario(() => {
    queues = new FakeQueues();
    alerts = [];
    watchdog = createWatchdog({
      probes: queues.probes(),
      alert: (text) => {
        alerts.push(text);
        return Promise.resolve();
      },
    });
  });

  type Fn<A extends unknown[]> = (ctx: unknown, ...args: A) => void | Promise<void>;
  type Step<A extends unknown[] = []> = (text: string, fn: Fn<A>) => void;

  const waiting = (Given: Step<[string, number]>) => {
    Given("a fila {string} com uma mensagem esperando há {int} segundos", (_ctx, name, seconds) => {
      queues.set(name, { oldestWaitingAt: NOW - seconds * 1000 });
    });
  };
  const check = (When: Step) => {
    When("o vigia confere as filas", () => watchdog.check(NOW));
  };
  const alreadyChecked = (And: Step) => {
    And("o vigia já conferiu as filas", async () => {
      await watchdog.check(NOW);
      alerts = [];
    });
  };
  const receives = (Then: Step<[string]>, text: string) => {
    Then(text, (_ctx, expected) => {
      expect(alerts).toEqual([expected]);
    });
  };

  Scenario("Mensagem parada há mais de 60 s gera alerta", ({ Given, When, Then }) => {
    waiting(Given);
    check(When);
    receives(Then, "a operação recebe o alerta {string}");
  });

  Scenario("Mensagem esperando há menos de 60 s não gera alerta", ({ Given, When, Then }) => {
    waiting(Given);
    check(When);
    Then("a operação não recebe alerta", () => {
      expect(alerts).toEqual([]);
    });
  });

  Scenario("Falha nova numa fila gera alerta uma vez", ({ Given, When, Then, And }) => {
    Given("a fila {string} com {int} falhas", (_ctx, name: string, n: number) => {
      queues.set(name, { failed: n });
    });
    alreadyChecked(And);
    When("a fila {string} passa a ter {int} falhas", (_ctx, name: string, n: number) => {
      queues.set(name, { failed: n });
    });
    check(And);
    And("o vigia confere as filas de novo", () => watchdog.check(NOW + 60_000));
    receives(Then, "a operação recebe só o alerta {string}");
  });

  Scenario(
    "Problema que continua não repete o alerta e a volta ao normal é avisada",
    ({ Given, When, Then, And }) => {
      waiting(Given);
      alreadyChecked(And);
      When("a fila {string} volta a andar", (_ctx, name: string) => {
        queues.set(name, { oldestWaitingAt: null });
      });
      check(And);
      receives(Then, "a operação recebe só o alerta {string}");
    },
  );

  Scenario("Redis fora do ar gera alerta", ({ Given, When, Then }) => {
    Given("o Redis fora do ar", () => {
      queues.down = true;
    });
    check(When);
    receives(Then, "a operação recebe o alerta {string}");
  });
});
