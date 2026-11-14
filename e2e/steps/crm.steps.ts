import { expect, type Page } from "@playwright/test";
import { Given, Then, When } from "./fixtures";

/** Abre a página e espera o canal do Realtime confirmar a assinatura no Postgres. */
async function openLive(page: Page, path: string): Promise<void> {
  const subscribed = new Promise<void>((resolve) => {
    page.on("websocket", (ws) => {
      ws.on("framereceived", (frame) => {
        if (String(frame.payload).includes("Subscribed to PostgreSQL")) resolve();
      });
    });
  });
  await page.goto(path);
  await Promise.race([
    subscribed,
    new Promise((_, reject) =>
      setTimeout(() => {
        reject(new Error(`Realtime não assinou em ${path}`));
      }, 15_000),
    ),
  ]);
}

const column = (page: Page, label: string) => page.locator(`section[aria-label^="${label}:"]`);

Given(
  "uma imobiliária de teste com a gestora {string} e a corretora {string}",
  async ({ org }, admin: string, agent: string) => {
    await org.person(admin, "org_admin");
    await org.person(agent, "agent");
  },
);

Given(
  "o lead {string} atribuído a {string} há {int} horas sem resposta",
  async ({ org }, lead: string, owner: string, hours: number) => {
    await org.lead(lead, { owner, assignedHoursAgo: hours });
  },
);

Given("o lead {string} sem dono", async ({ org }, lead: string) => {
  await org.lead(lead);
});

Given(
  "o lead {string} de {string} no estágio {string}",
  async ({ org }, lead: string, owner: string, stage: string) => {
    await org.lead(lead, { owner, stage });
  },
);

Given("a unidade {string} disponível", async ({ org }, code: string) => {
  await org.unit(code, "available");
});

Given("{string} está vendo {string} ao vivo", async ({ people }, name: string, path: string) => {
  await openLive(await people.page(name), path);
});

When("{string} entra pelo link mágico", async ({ people }, name: string) => {
  await people.page(name);
});

When("{string} abre {string}", async ({ people }, name: string, path: string) => {
  await (await people.page(name)).goto(path);
});

When("{string} coloca {string} no rodízio", async ({ people }, name: string, member: string) => {
  const page = await people.page(name);
  await page.goto("/app/equipe");
  const row = page.getByRole("row", { name: new RegExp(member) });
  await row.getByRole("button", { name: "Colocar" }).click();
  await expect(row.getByRole("status")).toHaveText("Entrou no rodízio");
});

When(
  "{string} distribui {string} pelo rodízio",
  async ({ people, org }, name: string, lead: string) => {
    const page = await people.page(name);
    await page.goto(`/app/leads/${org.leadId(lead)}`);
    const drawer = page.getByRole("complementary", { name: "Ficha do lead" });
    await drawer.getByRole("button", { name: "Atribuir pelo rodízio" }).click();
    // Depois de distribuir, o botão some: o lead já tem dono.
    await expect(drawer.getByRole("button", { name: "Atribuir pelo rodízio" })).toHaveCount(0);
  },
);

When(
  "{string} arrasta {string} para a coluna {string}",
  async ({ people }, name: string, lead: string, label: string) => {
    const page = await people.page(name);
    await page.goto("/app/funil");
    const card = page.locator("article", { hasText: lead });
    await card.waitFor();
    const box = await card.boundingBox();
    if (!box) throw new Error(`card não encontrado: ${lead}`);
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + 20, { steps: 5 });
    // Leva o card até a coluna de destino. Se ela estiver fora da tela, segura o cursor na borda
    // direita do quadro: o dnd-kit rola o quadro sozinho (como faria uma pessoa).
    const board = await page.locator("[aria-busy]").first().boundingBox();
    if (!board) throw new Error("quadro do funil não encontrado");
    const target = column(page, label);
    const edge = board.x + board.width - 8;
    for (let i = 0; i < 60; i++) {
      const t = await target.boundingBox();
      if (t && t.x + t.width / 2 < edge) break;
      await page.mouse.move(edge, box.y + 20, { steps: 2 });
      await page.waitForTimeout(100);
    }
    // Como uma pessoa: só solta quando a coluna de destino acende. A rolagem automática pode
    // continuar por um instante, então o cursor acompanha a coluna até ela ficar destacada.
    await expect(async () => {
      const t = await target.boundingBox();
      if (!t) throw new Error(`coluna não encontrada: ${label}`);
      await page.mouse.move(t.x + t.width / 2, t.y + 60, { steps: 4 });
      await expect(target).toHaveClass(/ring-2/, { timeout: 300 });
    }).toPass({ timeout: 10_000 });
    await page.mouse.up();
  },
);

When("{string} informa o motivo {string}", async ({ people }, name: string, reason: string) => {
  const page = await people.page(name);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo da perda").fill(reason);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toHaveCount(0);
});

When(
  "{string} marca a unidade {string} como {string}",
  async ({ people }, name: string, code: string, status: string) => {
    const page = await people.page(name);
    await page.goto("/app/imoveis");
    await page.getByLabel(`Status de ${code}`).selectOption({ label: status });
    await expect(page.getByLabel(`Status de ${code}`)).toHaveValue(/.+/);
  },
);

When("o lead {string} vai para {string} por fora", async ({ org }, lead: string, stage: string) => {
  await org.setStage(lead, stage);
});

Then("{string} vê o título {string}", async ({ people }, name: string, title: string) => {
  await expect((await people.page(name)).getByRole("heading", { level: 1 })).toHaveText(title);
});

Then("{string} vê o alerta {string}", async ({ people }, name: string, text: string) => {
  await expect((await people.page(name)).locator("main").getByRole("alert")).toContainText(text);
});

Then(
  "a ficha de {string} mostra a corretora {string}",
  async ({ people, org }, lead: string, owner: string) => {
    const [admin] = [...org.people.keys()];
    const page = await people.page(admin ?? "");
    await page.goto(`/app/leads/${org.leadId(lead)}`);
    const drawer = page.getByRole("complementary", { name: "Ficha do lead" });
    await expect(drawer.locator("div", { hasText: /^Corretor/ }).last()).toContainText(owner);
    expect((await org.leadStage(lead)).owner_id).toBe(org.userId(owner));
  },
);

Then("{string} não vê botões de rodízio", async ({ people }, name: string) => {
  const page = await people.page(name);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Equipe");
  await expect(page.getByRole("button", { name: /Colocar|Tirar/ })).toHaveCount(0);
});

Then("{string} vê o pedido de motivo da perda", async ({ people }, name: string) => {
  const dialog = (await people.page(name)).getByRole("dialog");
  await expect(dialog).toContainText("Marcar como perdido");
});

Then(
  "{string} fica na coluna {string} depois de recarregar",
  async ({ people, org }, lead: string, label: string) => {
    const [admin] = [...org.people.keys()];
    const page = await people.page(admin ?? "");
    await page.reload();
    await expect(column(page, label).getByText(lead, { exact: true })).toBeVisible();
  },
);

Then(
  "{string} vê a unidade {string} como {string} sem recarregar",
  async ({ people }, name: string, code: string, status: string) => {
    const row = (await people.page(name)).getByRole("row", { name: new RegExp(code) });
    await expect(row).toContainText(status, { timeout: 10_000 });
  },
);

Then(
  "{string} vê {string} na coluna {string} sem recarregar",
  async ({ people }, name: string, lead: string, label: string) => {
    const page = await people.page(name);
    await expect(column(page, label).getByText(lead, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  },
);

// LGPD (T4.2): exportar e excluir os dados do lead pela ficha.
const drawerOf = (page: Page) => page.getByRole("complementary", { name: "Ficha do lead" });
let downloaded: { name: string; text: string } | null = null;

When(
  "{string} exporta os dados de {string} pela ficha",
  async ({ people, org }, name: string, lead: string) => {
    const page = await people.page(name);
    await page.goto(`/app/leads/${org.leadId(lead)}`);
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      drawerOf(page).getByRole("link", { name: "Exportar dados" }).click(),
    ]);
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    downloaded = { name: file.suggestedFilename(), text: Buffer.concat(chunks).toString("utf8") };
  },
);

// eslint-disable-next-line no-empty-pattern -- o playwright-bdd exige desestruturar as fixtures
Then("baixa um arquivo JSON com o nome {string}", ({}, lead: string) => {
  expect(downloaded?.name).toMatch(/^dados-lead-.+\.json$/);
  const data = JSON.parse(downloaded?.text ?? "null") as { lead?: { name?: string } } | null;
  expect(data?.lead?.name).toBe(lead);
});

When(
  "{string} pede para excluir os dados de {string} pela ficha",
  async ({ people, org }, name: string, lead: string) => {
    const page = await people.page(name);
    await page.goto(`/app/leads/${org.leadId(lead)}`);
    await drawerOf(page).getByRole("link", { name: "Excluir dados" }).click();
  },
);

Then(
  "{string} vê o aviso de que a exclusão não pode ser desfeita",
  async ({ people }, name: string) => {
    const dialog = (await people.page(name)).getByRole("alertdialog", { name: "Confirmar exclusão" });
    await expect(dialog).toContainText("A exclusão não pode ser desfeita");
  },
);

When("{string} confirma a exclusão", async ({ people }, name: string) => {
  const page = await people.page(name);
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await page.waitForURL(/\/app\/leads\?lgpd=excluido/);
});

Then("{string} vê a mensagem {string}", async ({ people }, name: string, text: string) => {
  await expect((await people.page(name)).getByRole("status").filter({ hasText: text })).toBeVisible();
});

Then("{string} não aparece mais na lista de leads", async ({ people, org }, lead: string) => {
  const [admin] = [...org.people.keys()];
  const page = await people.page(admin ?? "");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Leads");
  // Só o visível: com cacheComponents o Next guarda a página anterior (a ficha) montada e oculta.
  await expect(page.getByText("0 de 0 leads")).toBeVisible();
  await expect(
    page.getByRole("main").getByText(lead, { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
});

When(
  "{string} abre a ficha de {string}",
  async ({ people, org }, name: string, lead: string) => {
    await (await people.page(name)).goto(`/app/leads/${org.leadId(lead)}`);
  },
);

Then("{string} não vê as ações de dados do lead", async ({ people }, name: string) => {
  const drawer = drawerOf(await people.page(name));
  await expect(drawer.getByRole("heading", { level: 2 })).not.toHaveText("Lead não encontrado");
  await expect(drawer.getByRole("link", { name: /Exportar dados|Excluir dados/ })).toHaveCount(0);
});

// T4.3: agência, convites e configurações.
Given("o admin da plataforma {string}", async ({ org }, name: string) => {
  await org.platformAdmin(name);
});

When(
  "{string} cria a imobiliária {string} com o gestor {string} pela tela da agência",
  async ({ people, org }, name: string, orgName: string, admin: string) => {
    const page = await people.page(name);
    await page.goto("/app/agencia");
    const form = page.getByRole("form", { name: "Nova imobiliária" });
    await form.getByLabel("Nome da imobiliária").fill(orgName);
    await form.getByLabel("Endereço do site").fill(org.newSlug(orgName.toLowerCase()));
    await form.getByLabel("Nome do gestor").fill(admin);
    await form.getByLabel("E-mail do gestor").fill(org.inviteEmail(admin));
    await form.getByRole("button", { name: "Criar e convidar" }).click();
  },
);

When(
  "{string} convida o corretor {string} pela tela da equipe",
  async ({ people, org }, name: string, invitee: string) => {
    const page = await people.page(name);
    await page.goto("/app/equipe");
    const form = page.getByRole("form", { name: "Convidar para a equipe" });
    await form.getByLabel("Nome").fill(invitee);
    await form.getByLabel("E-mail").fill(org.inviteEmail(invitee));
    await form.getByRole("button", { name: "Enviar convite" }).click();
    await expect(form.getByRole("status")).toContainText("Convite");
  },
);

Then("{string} vê {string} nos convites pendentes", async ({ people }, name: string, invitee: string) => {
  const page = await people.page(name);
  await page.reload();
  await expect(page.getByRole("list", { name: "Convites pendentes" })).toContainText(invitee);
});

When("{string} entra pelo convite", async ({ people, org }, name: string) => {
  await org.invitee(name);
  await people.page(name);
});

When(
  "{string} muda o prazo máximo para {string} nas configurações",
  async ({ people }, name: string, label: string) => {
    const page = await people.page(name);
    await page.goto("/app/config");
    const form = page.getByRole("form", { name: "Critério de qualificação" });
    await form.getByLabel("Prazo máximo de compra").selectOption({ label });
    await form.getByRole("button", { name: "Salvar critério" }).click();
  },
);

Then("o prazo máximo continua {string} depois de recarregar", async ({ people, org }, label: string) => {
  const [admin] = [...org.people.keys()];
  const page = await people.page(admin ?? "");
  await page.reload();
  const select = page.getByRole("form", { name: "Critério de qualificação" }).getByLabel("Prazo máximo de compra");
  await expect(select.locator("option:checked")).toHaveText(label);
});

// T4.5: revisão e publicação da tabela importada.
let importId = "";

Given(
  "um rascunho importado com {string} a {int} e a unidade nova {string}",
  async ({ org }, existing: string, price: number, fresh: string) => {
    importId = await org.importDraft([
      { code: existing, price },
      { code: fresh, price: 900_000 },
    ]);
  },
);

When("{string} abre a revisão da importação", async ({ people }, name: string) => {
  await (await people.page(name)).goto(`/app/imoveis/importar/${importId}`);
});

Then(
  "{string} vê {string} como {string} e {string} como {string}",
  async ({ people }, name: string, a: string, kindA: string, b: string, kindB: string) => {
    const page = await people.page(name);
    await expect(page.getByRole("row", { name: new RegExp(a) })).toContainText(kindA);
    await expect(page.getByRole("row", { name: new RegExp(b) })).toContainText(kindB);
  },
);

When("{string} publica a importação pela tela", async ({ people }, name: string) => {
  await (await people.page(name)).getByRole("button", { name: "Publicar" }).click();
});

Then(
  "{string} vê a unidade {string} em {string}",
  async ({ people }, name: string, code: string, path: string) => {
    const page = await people.page(name);
    await page.goto(path);
    await expect(page.getByRole("row", { name: new RegExp(code) }).filter({ visible: true })).toHaveCount(1);
  },
);

// T4.6: relatório mensal.
When("{string} abre o relatório do mês atual", async ({ people }, name: string) => {
  const br = new Date(Date.now() - 3 * 3_600_000);
  const month = `${String(br.getUTCFullYear())}-${String(br.getUTCMonth() + 1).padStart(2, "0")}`;
  await (await people.page(name)).goto(`/app/relatorios?mes=${month}`);
});

Then(
  "o funil do relatório mostra {int} lead e {int} visita",
  async ({ people, org }, leads: number, visits: number) => {
    const [admin] = [...org.people.keys()];
    const funnel = (await people.page(admin ?? "")).getByRole("region", { name: "Funil do mês" });
    await expect(funnel.getByRole("row", { name: /^Leads/ }).getByRole("cell").nth(1)).toHaveText(String(leads));
    await expect(funnel.getByRole("row", { name: /^Visitas/ }).getByRole("cell").nth(1)).toHaveText(String(visits));
  },
);

Then("o relatório por corretor mostra {string}", async ({ people, org }, agent: string) => {
  const [admin] = [...org.people.keys()];
  const section = (await people.page(admin ?? "")).getByRole("region", { name: "Por corretor" });
  await expect(section.getByRole("row", { name: new RegExp(agent) })).toHaveCount(1);
});

// Editar unidade.
When(
  "{string} muda o preço de {string} para {string}",
  async ({ people, org }, name: string, code: string, price: string) => {
    const page = await people.page(name);
    await page.goto(`/app/imoveis/unidade/${org.units.get(code) ?? ""}`);
    const form = page.getByRole("form", { name: "Ficha da unidade" });
    await form.getByLabel("Preço (R$)").fill(price);
    await form.getByRole("button", { name: "Salvar unidade" }).click();
  },
);

Then(
  "a lista de imóveis mostra {string} a {string}",
  async ({ people, org }, code: string, price: string) => {
    const [admin] = [...org.people.keys()];
    const page = await people.page(admin ?? "");
    await page.goto("/app/imoveis");
    await expect(page.getByRole("row", { name: new RegExp(code) }).filter({ visible: true })).toContainText(price);
  },
);
