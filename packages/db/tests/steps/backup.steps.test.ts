import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";

const feature = await loadFeature("../../features/infra/backup.feature", { language: "pt" });

const IMAGE = "c1imob-backup:test";
const LOCAL_DB = "postgresql://postgres:postgres@host.docker.internal:64322/postgres";
const DEAD_DB = "postgresql://postgres:postgres@host.docker.internal:1/postgres";
const ENABLED = process.env["BACKUP_TEST"] === "1";

type Event = { event: string; [key: string]: unknown };
type Run = { code: number; events: Event[] };

/** Roda o contêiner de backup uma vez e lê os eventos JSON que ele escreve. */
function runBackup(databaseUrl: string): Run {
  const r = spawnSync(
    "docker",
    ["run", "--rm", "-e", `BACKUP_DATABASE_URL=${databaseUrl}`, IMAGE, "once"],
    { encoding: "utf8", timeout: 180_000 },
  );
  const events = `${r.stdout}\n${r.stderr}`
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l) as Event);
  return { code: r.status ?? -1, events };
}

describe.skipIf(!ENABLED)("backup (BACKUP_TEST=1)", () => {
  // Só com a feature ligada: no CI (sem BACKUP_TEST) nem o Docker é chamado.
  if (ENABLED) {
    const dir = fileURLToPath(new URL("../../../../infra/backup", import.meta.url));
    execFileSync("docker", ["build", "-q", "-t", IMAGE, dir]);
  }

  describeFeature(feature, ({ Scenario }) => {
    let run: Run = { code: -1, events: [] };
    const of = (name: string) => run.events.filter((e) => e.event === name);

    Scenario("A cópia é gravada, restaurada e conferida", ({ When, Then, And }) => {
      When("o backup roda contra o banco local", () => {
        run = runBackup(LOCAL_DB);
      });
      Then("uma cópia é gravada", () => {
        expect(of("backup_written")).toHaveLength(1);
      });
      And("a cópia é restaurada e conferida com todas as tabelas do banco", () => {
        expect(run.code).toBe(0);
        const [verified] = of("backup_verified");
        expect(Number(verified?.["tables"])).toBeGreaterThanOrEqual(16);
        expect(of("backup_failed")).toEqual([]);
      });
    });

    Scenario("Banco inacessível gera alerta e nenhuma cópia", ({ When, Then, And }) => {
      When("o backup roda contra um banco que não responde", () => {
        run = runBackup(DEAD_DB);
      });
      Then("o backup falha com o alerta {string}", (_ctx, text: string) => {
        expect(run.code).toBe(1);
        expect(String(of("backup_failed")[0]?.["reason"])).toContain(text);
      });
      And("nenhuma cópia é gravada", () => {
        expect(of("backup_written")).toEqual([]);
      });
    });
  });
});
