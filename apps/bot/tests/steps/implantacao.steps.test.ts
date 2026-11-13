import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { parse } from "yaml";

const feature = await loadFeature("../../features/infra/implantacao.feature", { language: "pt" });

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const COMPOSE = `${ROOT}infra/hetzner/docker-compose.yml`;
const DOCKERFILE = `${ROOT}apps/bot/Dockerfile`;
const PROD_ENV_EXAMPLE = `${ROOT}infra/hetzner/.env.example`;

type Service = {
  ports?: string[];
  command?: string | string[];
  volumes?: string[];
  restart?: string;
  env_file?: string | string[];
  healthcheck?: { test?: string | string[] };
  depends_on?: Record<string, { condition?: string }> | string[];
};
type Compose = { services: Record<string, Service> };

const words = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(" ") : (v ?? ""));

describeFeature(feature, ({ Background, Scenario }) => {
  let compose: Compose;
  const service = (name: string) => {
    const s = compose.services[name];
    if (!s) throw new Error(`serviço ausente no Compose: ${name}`);
    return s;
  };

  Background(({ Given }) => {
    Given("o Compose de produção do bot", () => {
      expect(existsSync(COMPOSE)).toBe(true);
      compose = parse(readFileSync(COMPOSE, "utf8")) as Compose;
    });
  });

  Scenario("Só o Caddy fica exposto na internet", ({ Then, And }) => {
    Then(
      "só o serviço {string} publica portas, e só as portas {int} e {int}",
      (_ctx, name: string, a: number, b: number) => {
        const publishing = Object.entries(compose.services)
          .filter(([, s]) => (s.ports ?? []).length > 0)
          .map(([n]) => n);
        expect(publishing).toEqual([name]);
        const published = (service(name).ports ?? []).map((p) => Number(p.split(":")[0]));
        expect(published.sort((x, y) => x - y)).toEqual([a, b]);
      },
    );
    And("o {string} e o {string} não publicam nenhuma porta", (_ctx, x: string, y: string) => {
      expect(service(x).ports).toBeUndefined();
      expect(service(y).ports).toBeUndefined();
    });
  });

  Scenario("As filas sobrevivem a um reinício", ({ Then, And }) => {
    Then("o {string} grava em disco com append-only", (_ctx, name: string) => {
      expect(words(service(name).command)).toMatch(/--appendonly yes/);
    });
    And("os dados do {string} ficam num volume", (_ctx, name: string) => {
      expect(service(name).volumes?.some((v) => v.endsWith(":/data"))).toBe(true);
    });
  });

  Scenario("O Caddy só manda tráfego para o bot saudável", ({ Then, And }) => {
    Then("o {string} tem verificação de saúde em {string}", (_ctx, name: string, path: string) => {
      expect(words(service(name).healthcheck?.test)).toContain(path);
    });
    And(
      "o {string} espera o {string} ficar saudável para subir",
      (_ctx, name: string, dep: string) => {
        const deps = service(name).depends_on as Record<string, { condition?: string }>;
        expect(deps[dep]?.condition).toBe("service_healthy");
      },
    );
  });

  Scenario("Tudo volta sozinho depois de uma queda", ({ Then }) => {
    Then("todos os serviços reiniciam sozinhos", () => {
      for (const [name, s] of Object.entries(compose.services)) {
        expect(s.restart, name).toBe("unless-stopped");
      }
    });
  });

  Scenario("Segredos ficam fora dos arquivos versionados", ({ Then, And }) => {
    Then(
      "o {string} lê as variáveis de um arquivo {string} que não vai para o git",
      (_ctx, name: string, file: string) => {
        expect(words(service(name).env_file)).toBe(file);
        // `git check-ignore` sai com 0 quando o caminho é ignorado.
        expect(() =>
          execFileSync("git", ["check-ignore", "-q", `infra/hetzner/${file}`], { cwd: ROOT }),
        ).not.toThrow();
      },
    );
    And("o exemplo de variáveis de produção não tem nenhum valor secreto preenchido", () => {
      const lines = readFileSync(PROD_ENV_EXAMPLE, "utf8")
        .split("\n")
        .filter((l) => /^[A-Z_]+=/.test(l));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        const [key = "", value = ""] = line.split(/=(.*)/s);
        const secret = /SECRET|TOKEN|KEY|PASSWORD/.test(key) || /:\/\/[^/]*:[^@]+@/.test(value);
        if (secret) expect(value.trim(), key).toBe("");
      }
    });
  });

  Scenario("O bot roda sem privilégios de administrador", ({ Then, And }) => {
    Then("a imagem do bot roda com um usuário sem root", () => {
      const users = readFileSync(DOCKERFILE, "utf8").match(/^USER\s+(\S+)/gm) ?? [];
      expect(users.at(-1)).toBe("USER node");
    });
    And("a imagem do bot roda o código empacotado, não o TypeScript", () => {
      const cmd = readFileSync(DOCKERFILE, "utf8").match(/^CMD\s+(.+)$/m)?.[1] ?? "";
      expect(cmd).toContain("dist/server.js");
      expect(cmd).not.toContain(".ts");
    });
  });
});
