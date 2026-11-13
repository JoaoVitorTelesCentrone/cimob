import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { redirectFor } from "@/lib/access";
import { parseEmail, type EmailResult } from "@/lib/email";
import { decideOrganization, type Decision, type OrgOption } from "@/lib/org-choice";

const feature = await loadFeature("../../features/crm/acesso.feature", { language: "pt" });

const ORGS: Record<string, OrgOption> = {
  Horizonte: { id: "org-horizonte", name: "Horizonte" },
  Alfa: { id: "org-alfa", name: "Alfa" },
};

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let redirect: string | null = null;
  let emailResult: EmailResult;
  let orgs: OrgOption[] = [];
  let preferred: string | null = null;
  let decision: Decision;

  const open = (path: string, signedIn: boolean) => {
    redirect = redirectFor(path, signedIn);
  };

  Scenario("Visitante sem sessão é levado ao login", ({ When, Then }) => {
    When("alguém sem sessão abre {string}", (_ctx, path: string) => {
      open(path, false);
    });
    Then("é redirecionado para {string}", (_ctx, to: string) => {
      expect(redirect).toBe(to);
    });
  });

  Scenario("Quem já está logado não vê a tela de login", ({ When, Then }) => {
    When("alguém com sessão abre {string}", (_ctx, path: string) => {
      open(path, true);
    });
    Then("é redirecionado para {string}", (_ctx, to: string) => {
      expect(redirect).toBe(to);
    });
  });

  Scenario("Páginas públicas não exigem login", ({ When, Then }) => {
    When("alguém sem sessão abre {string}", (_ctx, path: string) => {
      open(path, false);
    });
    Then("não há redirecionamento", () => {
      expect(redirect).toBeNull();
    });
  });

  ScenarioOutline("E-mail inválido é recusado", ({ When, Then }, variables) => {
    When('a pessoa pede o link com o e-mail "<email>"', () => {
      emailResult = parseEmail(variables["email"] as string);
    });
    Then('vê a mensagem "Informe um e-mail válido"', () => {
      expect(emailResult).toEqual({ ok: false, message: "Informe um e-mail válido" });
    });
  });

  Scenario("E-mail válido é aceito e normalizado", ({ When, Then }) => {
    When("a pessoa pede o link com o e-mail {string}", (_ctx, email: string) => {
      emailResult = parseEmail(email);
    });
    Then("o link é enviado para {string}", (_ctx, email: string) => {
      expect(emailResult).toEqual({ ok: true, email });
    });
  });

  const given = (names: string[]) => {
    orgs = names.map((n) => ORGS[n] as OrgOption);
    preferred = null;
  };

  Scenario("Quem tem uma só imobiliária entra direto nela", ({ Given, When, Then }) => {
    Given("o usuário pertence a {string}", (_ctx, a: string) => {
      given([a]);
    });
    When("termina o login", () => {
      decision = decideOrganization(orgs, preferred);
    });
    Then("entra na {string}", (_ctx, name: string) => {
      expect(decision).toEqual({ kind: "enter", organization: ORGS[name] });
    });
  });

  Scenario("Quem tem várias imobiliárias escolhe uma", ({ Given, When, Then }) => {
    Given("o usuário pertence a {string} e {string}", (_ctx, a: string, b: string) => {
      given([a, b]);
    });
    When("termina o login", () => {
      decision = decideOrganization(orgs, preferred);
    });
    Then("escolhe entre {string} e {string}", (_ctx, a: string, b: string) => {
      expect(decision).toEqual({ kind: "choose", options: [ORGS[a], ORGS[b]] });
    });
  });

  Scenario("A última imobiliária usada é lembrada", ({ Given, And, When, Then }) => {
    Given("o usuário pertence a {string} e {string}", (_ctx, a: string, b: string) => {
      given([a, b]);
    });
    And("a última imobiliária usada foi {string}", (_ctx, name: string) => {
      preferred = ORGS[name]?.id ?? `org-${name.toLowerCase()}`;
    });
    When("termina o login", () => {
      decision = decideOrganization(orgs, preferred);
    });
    Then("entra na {string}", (_ctx, name: string) => {
      expect(decision).toEqual({ kind: "enter", organization: ORGS[name] });
    });
  });

  Scenario("Imobiliária lembrada que o usuário perdeu é ignorada", ({ Given, And, When, Then }) => {
    Given("o usuário pertence a {string} e {string}", (_ctx, a: string, b: string) => {
      given([a, b]);
    });
    And("a última imobiliária usada foi {string}", (_ctx, name: string) => {
      preferred = ORGS[name]?.id ?? `org-${name.toLowerCase()}`;
    });
    When("termina o login", () => {
      decision = decideOrganization(orgs, preferred);
    });
    Then("escolhe entre {string} e {string}", (_ctx, a: string, b: string) => {
      expect(decision).toEqual({ kind: "choose", options: [ORGS[a], ORGS[b]] });
    });
  });

  Scenario("Usuário sem imobiliária não entra no CRM", ({ Given, When, Then }) => {
    Given("o usuário não pertence a nenhuma imobiliária", () => {
      given([]);
    });
    When("termina o login", () => {
      decision = decideOrganization(orgs, preferred);
    });
    Then("vê a mensagem {string}", (_ctx, message: string) => {
      expect(decision).toEqual({ kind: "none", message });
    });
  });
});
