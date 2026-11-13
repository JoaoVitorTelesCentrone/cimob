import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { Scenario } from "../helpers.js";

const feature = await loadFeature("../../features/crm/onboarding.feature", { language: "pt" });

describeFeature(feature, ({ Background, Scenario: Sc, ScenarioOutline, AfterEachScenario }) => {
  let s: Scenario;
  let dbError: string | null = null;
  let errors: (string | null)[] = [];
  const byEmail = new Map<string, string>();

  AfterEachScenario(async () => {
    await s.end();
  });

  const userId = (name: string) => s.users.get(name) ?? "";
  const attempt = async (user: string, run: (c: Scenario["conn"]) => Promise<unknown>) => {
    dbError = await s.expectError(() => s.as(user, run));
  };

  const createOrg = (user: string, name: string, slug: string, admin: string, email: string) =>
    attempt(user, async (c) => {
      const [row] = await c<{ id: string }[]>`
        select public.create_organization(${name}, ${slug}, ${email}, ${admin}) as id`;
      if (row) s.orgs.set(name, row.id);
    });

  const invite = (user: string, org: string, name: string, email: string, whatsapp: string | null) =>
    attempt(
      user,
      (c) => c`select public.invite_member(${s.orgId(org)}, ${email}, 'agent', ${name}, ${whatsapp})`,
    );

  /** Primeira entrada: usuário novo no Auth com o e-mail, e o app aceita os convites dele. */
  const firstLogin = async (email: string) => {
    const id = randomUUID();
    await s.conn`insert into auth.users (id, email) values (${id}, ${email})`;
    byEmail.set(email, id);
    const claims = JSON.stringify({ sub: id, role: "authenticated" });
    await s.conn`select set_config('request.jwt.claims', ${claims}, true)`;
    await s.conn.unsafe("set local role authenticated");
    try {
      await s.conn`select public.accept_my_invitations()`;
    } finally {
      await s.conn.unsafe("reset role");
    }
  };

  const brandOf = async (org: string) => {
    const [row] = await s.conn<{ brand: Record<string, unknown> }[]>`
      select brand from organizations where id = ${s.orgId(org)}`;
    return row?.brand ?? {};
  };
  const setBrand = (user: string, color: string, creci: string, whatsapp: string) =>
    s.as(
      user,
      (c) => c`update organizations
               set brand = brand || ${c.json({ color, creci, whatsapp })}
               where id = ${s.orgId("Horizonte")}`,
    );

  Background(({ Given, And }) => {
    Given("o admin da plataforma {string}", async (_ctx, name: string) => {
      s = await Scenario.begin();
      dbError = null;
      errors = [];
      byEmail.clear();
      await s.conn`insert into platform_admins (user_id) values (${await s.user(name)})`;
    });
    And(
      "a imobiliária {string} com a gestora {string} e a corretora {string}",
      async (_ctx, org: string, admin: string, agent: string) => {
        await s.org(org, { slug: org.toLowerCase() });
        await s.member(admin, org, "org_admin");
        await s.member(agent, org, "agent");
      },
    );
    And("a imobiliária {string} com o gestor {string}", async (_ctx, org: string, admin: string) => {
      await s.org(org);
      await s.member(admin, org, "org_admin");
    });
  });

  const refused = (Then: (t: string, f: () => void) => void) => {
    Then("o banco recusa", () => {
      expect(dbError).not.toBeNull();
    });
  };
  type Step5 = (
    t: string,
    f: (c: unknown, a: string, b: string, c2: string, d: string, e: string) => Promise<void>,
  ) => void;
  type Step4 = (t: string, f: (c: unknown, a: string, b: string, c2: string, d: string) => Promise<void>) => void;
  const createStep = (When: Step5) => {
    When(
      "{string} cria a imobiliária {string} no endereço {string} com o gestor {string} de e-mail {string}",
      async (_ctx, user, name, slug, admin, email) => {
        await createOrg(user, name, slug, admin, email);
      },
    );
  };

  Sc("Admin da plataforma cria a imobiliária e convida o gestor", ({ When, Then, And }) => {
    createStep(When);
    Then(
      "a imobiliária {string} existe no endereço {string}",
      async (_ctx, name: string, slug: string) => {
        expect(dbError).toBeNull();
        const [row] = await s.conn<{ name: string }[]>`select name from organizations where slug = ${slug}`;
        expect(row?.name).toBe(name);
      },
    );
    And("{string} acessa a {string} como agência", async (_ctx, user: string, org: string) => {
      const [row] = await s.as(
        user,
        (c) => c<{ role: string }[]>`select public.role_in(${s.orgId(org)})::text as role`,
      );
      expect(row?.role).toBe("agency_admin");
    });
    And(
      "há um convite pendente para {string} como gestor {string} na {string}",
      async (_ctx, email: string, name: string, org: string) => {
        const rows = await s.conn<{ role: string; display_name: string; accepted_at: Date | null }[]>`
          select role::text, display_name, accepted_at from invitations
          where organization_id = ${s.orgId(org)} and email = ${email}`;
        expect(rows).toEqual([{ role: "org_admin", display_name: name, accepted_at: null }]);
      },
    );
  });

  ScenarioOutline("Endereço inválido, reservado ou repetido é recusado", ({ When, Then }, vars) => {
    When(
      "{string} cria a imobiliária {string} no endereço {string} com o gestor {string} de e-mail {string}",
      async (_ctx, user: string, name: string, _slug: string, admin: string, email: string) => {
        await createOrg(user, name, vars["endereço"] as string, admin, email);
      },
    );
    refused(Then);
  });

  Sc("Gestor de imobiliária não cria imobiliária", ({ When, Then }) => {
    createStep(When);
    refused(Then);
  });

  Sc("Gestora convida um corretor e ele entra pela 1ª vez", ({ When, Then, And }) => {
    When(
      "{string} convida {string} de e-mail {string} e WhatsApp {string} como corretor",
      async (_ctx, user: string, name: string, email: string, whatsapp: string) => {
        await invite(user, "Horizonte", name, email, whatsapp);
        expect(dbError).toBeNull();
      },
    );
    And("a pessoa de e-mail {string} entra pela 1ª vez", async (_ctx, email: string) => {
      await firstLogin(email);
    });
    Then(
      "{string} é corretor ativo da {string} com o WhatsApp {string}",
      async (_ctx, name: string, org: string, whatsapp: string) => {
        const rows = await s.conn<{ role: string; active: boolean; whatsapp: string | null }[]>`
          select role::text, active, whatsapp from memberships
          where organization_id = ${s.orgId(org)} and display_name = ${name}`;
        expect(rows).toEqual([{ role: "agent", active: true, whatsapp }]);
      },
    );
    And("o convite de {string} fica aceito", async (_ctx, email: string) => {
      const [row] = await s.conn<{ accepted_by: string | null }[]>`
        select accepted_by from invitations where email = ${email}`;
      expect(row?.accepted_by).toBe(byEmail.get(email));
    });
  });

  Sc("Convite só vale para o e-mail convidado", ({ Given, When, Then }) => {
    Given(
      "{string} convidou {string} de e-mail {string} como corretor",
      async (_ctx, user: string, name: string, email: string) => {
        await invite(user, "Horizonte", name, email, null);
        expect(dbError).toBeNull();
      },
    );
    When("a pessoa de e-mail {string} entra pela 1ª vez", async (_ctx, email: string) => {
      await firstLogin(email);
    });
    Then(
      "a pessoa de e-mail {string} não é membro de nenhuma imobiliária",
      async (_ctx, email: string) => {
        const rows = await s.conn`select 1 from memberships where user_id = ${byEmail.get(email) ?? ""}`;
        expect(rows).toHaveLength(0);
      },
    );
  });

  Sc("Corretora não convida", ({ When, Then }) => {
    When(
      "{string} convida {string} de e-mail {string} e WhatsApp {string} como corretor",
      async (_ctx, user: string, name: string, email: string, whatsapp: string) => {
        await invite(user, "Horizonte", name, email, whatsapp);
      },
    );
    refused(Then);
  });

  Sc("Gestor de outra imobiliária não convida na Horizonte", ({ When, Then }) => {
    When(
      "{string} convida para a {string} {string} de e-mail {string} como corretor",
      async (_ctx, user: string, org: string, name: string, email: string) => {
        await invite(user, org, name, email, null);
      },
    );
    refused(Then);
  });

  Sc(
    "Gestora desativa a corretora, que perde o acesso e sai do rodízio",
    ({ Given, When, Then, And }) => {
      Given("{string} está no rodízio", async (_ctx, name: string) => {
        await s.conn`update memberships set in_rotation = true where user_id = ${userId(name)}`;
        await s.lead("Horizonte", "Ana", undefined, name);
      });
      When("{string} desativa {string}", async (_ctx, user: string, member: string) => {
        await attempt(
          user,
          (c) => c`select public.set_member_active(${s.orgId("Horizonte")}, ${userId(member)}, false)`,
        );
        expect(dbError).toBeNull();
      });
      Then("{string} não lê mais os leads da {string}", async (_ctx, name: string, org: string) => {
        const rows = await s.as(
          name,
          (c) => c`select id from leads where organization_id = ${s.orgId(org)}`,
        );
        expect(rows).toHaveLength(0);
      });
      And("{string} não está no rodízio", async (_ctx, name: string) => {
        const [row] = await s.conn<{ in_rotation: boolean }[]>`
          select in_rotation from memberships where user_id = ${userId(name)}`;
        expect(row?.in_rotation).toBe(false);
      });
    },
  );

  Sc("Gestora não desativa a si mesma", ({ When, Then }) => {
    When("{string} desativa {string}", async (_ctx, user: string, member: string) => {
      await attempt(
        user,
        (c) => c`select public.set_member_active(${s.orgId("Horizonte")}, ${userId(member)}, false)`,
      );
    });
    refused(Then);
  });

  Sc("Gestora muda a marca e o critério de qualificação", ({ When, Then, And }) => {
    When(
      "{string} muda a marca para a cor {string}, o CRECI {string} e o WhatsApp {string}",
      async (_ctx, user: string, color: string, creci: string, whatsapp: string) => {
        await setBrand(user, color, creci, whatsapp);
      },
    );
    And(
      "{string} muda o critério para prazo de até {int} meses e faixa cobrindo {int}% do preço",
      async (_ctx, user: string, months: number, share: number) => {
        await s.as(
          user,
          (c) => c`update organizations
                   set qualify_timeframe = ${`${String(months)}m`}, qualify_price_share = ${share / 100}
                   where id = ${s.orgId("Horizonte")}`,
        );
      },
    );
    Then(
      "a marca da {string} tem a cor {string}, o CRECI {string} e o WhatsApp {string}",
      async (_ctx, org: string, color: string, creci: string, whatsapp: string) => {
        expect(await brandOf(org)).toMatchObject({ color, creci, whatsapp });
      },
    );
    And(
      "o critério da {string} é prazo de até {int} meses e {int}% do preço",
      async (_ctx, org: string, months: number, share: number) => {
        const [row] = await s.conn<{ qualify_timeframe: string; qualify_price_share: string }[]>`
          select qualify_timeframe, qualify_price_share::text from organizations where id = ${s.orgId(org)}`;
        expect(row).toEqual({
          qualify_timeframe: `${String(months)}m`,
          qualify_price_share: (share / 100).toFixed(2),
        });
      },
    );
  });

  Sc("Gestora não muda endereço, domínio nem plano", ({ When, Then }) => {
    When(
      "{string} tenta mudar o endereço, o domínio e o plano da {string}",
      async (_ctx, user: string, org: string) => {
        const id = s.orgId(org);
        errors = [
          await s.expectError(() => s.as(user, (c) => c`update organizations set slug = 'outra' where id = ${id}`)),
          await s.expectError(() =>
            s.as(user, (c) => c`update organizations set custom_domain = 'x.com.br' where id = ${id}`),
          ),
          await s.expectError(() => s.as(user, (c) => c`update organizations set plan = 'pro' where id = ${id}`)),
        ];
      },
    );
    Then("o banco recusa nas três", () => {
      for (const e of errors) expect(e).toMatch(/permission denied/);
    });
  });

  Sc("Corretora não muda a marca", ({ When, Then }) => {
    let before: Record<string, unknown> = {};
    When(
      "{string} muda a marca para a cor {string}, o CRECI {string} e o WhatsApp {string}",
      async (_ctx, user: string, color: string, creci: string, whatsapp: string) => {
        before = await brandOf("Horizonte");
        await s.expectError(() => setBrand(user, color, creci, whatsapp));
      },
    );
    Then("a marca da {string} não mudou", async (_ctx, org: string) => {
      expect(await brandOf(org)).toEqual(before);
    });
  });

  const configureWhatsapp = (When: Step4) => {
    When(
      "{string} configura na {string} o número {string} com o token {string}",
      async (_ctx, user, org, phone, token) => {
        await attempt(
          user,
          (c) => c`select public.set_whatsapp_account(${s.orgId(org)}, ${phone}, ${token})`,
        );
      },
    );
  };

  Sc(
    "Admin da plataforma configura o WhatsApp do bot e a conta de anúncios, com token no cofre",
    ({ When, Then, And }) => {
      configureWhatsapp(When);
      And(
        "{string} configura na {string} a conta de anúncios {string} com o token {string}",
        async (_ctx, user: string, org: string, act: string, token: string) => {
          expect(dbError).toBeNull();
          await attempt(
            user,
            (c) => c`select public.set_meta_ads_account(${s.orgId(org)}, ${act}, ${token})`,
          );
          expect(dbError).toBeNull();
        },
      );
      Then(
        "o token do número {string} no cofre é {string}",
        async (_ctx, phone: string, token: string) => {
          const [row] = await s.conn<{ token: string }[]>`
            select s.decrypted_secret as token from whatsapp_accounts w
            join vault.decrypted_secrets s on s.id = w.token_secret_id where w.phone_number_id = ${phone}`;
          expect(row?.token).toBe(token);
        },
      );
      And("o token da conta {string} no cofre é {string}", async (_ctx, act: string, token: string) => {
        const [row] = await s.conn<{ token: string }[]>`
          select s.decrypted_secret as token from meta_ads_accounts a
          join vault.decrypted_secrets s on s.id = a.token_secret_id where a.ad_account_id = ${act}`;
        expect(row?.token).toBe(token);
      });
      And(
        "{string} vê o número {string} e a conta {string} com token guardado, sem ver os tokens",
        async (_ctx, user: string, phone: string, act: string) => {
          const [wa] = await s.as(
            user,
            (c) => c<{ phone_number_id: string; has_token: boolean }[]>`
              select phone_number_id, token_secret_id is not null as has_token from whatsapp_accounts`,
          );
          const [ads] = await s.as(
            user,
            (c) => c<{ ad_account_id: string; has_token: boolean }[]>`
              select ad_account_id, token_secret_id is not null as has_token from meta_ads_accounts`,
          );
          expect(wa).toEqual({ phone_number_id: phone, has_token: true });
          expect(ads).toEqual({ ad_account_id: act, has_token: true });
          const vault = await s.expectError(() =>
            s.as(user, (c) => c`select decrypted_secret from vault.decrypted_secrets`),
          );
          expect(vault).toMatch(/permission denied/);
        },
      );
    },
  );

  Sc("Gestora não configura o número do bot", ({ When, Then }) => {
    configureWhatsapp(When);
    refused(Then);
  });
});
