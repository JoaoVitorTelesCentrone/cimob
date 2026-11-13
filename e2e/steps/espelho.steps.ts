import { expect } from "@playwright/test";
import { boxesGltf } from "../support/gltf";
import { Given, Then, When } from "./fixtures";

/** URL fictícia do Storage: o navegador do teste recebe o modelo por `page.route`. */
const STATUS_VALUE: Record<string, string> = {
  Disponível: "available",
  Reservado: "reserved",
  Vendido: "sold",
};

const MODEL_URL = "https://modelos.e2e.test/aurora.gltf";

const STATUS_LABEL: Record<string, string> = {
  available: "Disponível",
  reserved: "Reservado",
  sold: "Vendido",
};

Given(
  "o site da {string} com o empreendimento {string}",
  async ({ org }, name: string, development: string) => {
    await org.publishSite({
      name,
      development,
      whatsapp: "5511900000000",
      units: [
        {
          code: "AUR-401",
          floor: 4,
          position: "01",
          bedrooms: 2,
          area: 62,
          parking: 1,
          price: 610000,
          status: "sold",
        },
        {
          code: "AUR-402",
          floor: 4,
          position: "02",
          bedrooms: 3,
          area: 82,
          parking: 2,
          price: 740000,
          status: "reserved",
          meshName: "Apto_402",
        },
        {
          code: "AUR-501",
          floor: 5,
          position: "01",
          bedrooms: 2,
          area: 62,
          parking: 1,
          price: 630000,
          status: "available",
          meshName: "Apto_501",
        },
        {
          code: "AUR-502",
          floor: 5,
          position: "02",
          bedrooms: 3,
          area: 82,
          parking: 2,
          price: 765000,
          status: "available",
          meshName: "Apto_502",
        },
      ],
    });
  },
);

Given("o empreendimento tem o modelo 3D do arquiteto", async ({ org, page }) => {
  // Objetos das unidades + partes do prédio que não são unidade (ficam como vieram).
  const gltf = boxesGltf(["Apto_402", "Apto_501", "Apto_502", "Fachada", "Laje"]);
  await page.route(MODEL_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "model/gltf+json",
      headers: { "access-control-allow-origin": "*" },
      body: gltf,
    }),
  );
  await org.setModelUrl(MODEL_URL);
});

When("o visitante abre o empreendimento", async ({ page, org, baseURL }) => {
  await page.goto(org.siteUrl(baseURL ?? "http://localhost:3100"));
});

When(
  "o visitante seleciona a unidade {string} na lista",
  async ({ page, org, baseURL }, n: string) => {
    await page.goto(org.siteUrl(baseURL ?? "http://localhost:3100"));
    await page
      .getByRole("list", { name: "Unidades" })
      .getByRole("button", { name: new RegExp(`^Unidade ${n},`) })
      .click();
  },
);

Then(
  "o card mostra {string}, {string} e {string}",
  async ({ page }, a: string, b: string, c: string) => {
    const card = page.getByRole("region", { name: /^Unidade / });
    for (const text of [a, b, c]) await expect(card).toContainText(text);
  },
);

Then(
  "o botão {string} abre o WhatsApp da imobiliária com o texto {string}",
  async ({ page }, label: string, text: string) => {
    const link = page.getByRole("region", { name: /^Unidade / }).getByRole("link", { name: label });
    const url = new URL((await link.getAttribute("href")) ?? "");
    expect(url.host).toBe("wa.me");
    expect(url.pathname).toBe("/5511900000000");
    expect(url.searchParams.get("text")).toContain(text);
  },
);

Then("o prédio 3D usa o modelo do arquiteto com as unidades da ficha ligadas", async ({ page }) => {
  const building = page.getByRole("img", { name: /Prédio em 3D/ });
  await expect(building).toHaveAttribute("data-source", "model", { timeout: 20_000 });
  // 3 das 4 unidades têm objeto no modelo; a AUR-401 fica fora do prédio.
  await expect(building).toHaveAttribute("data-units", "3");
});

Given(
  "o visitante está vendo a unidade {string} como {string}",
  async ({ page, org, baseURL }, n: string, label: string) => {
    await page.goto(org.siteUrl(baseURL ?? "http://localhost:3100"));
    await page
      .getByRole("list", { name: "Unidades" })
      .getByRole("button", { name: new RegExp(`^Unidade ${n},`) })
      .click();
    await expect(page.getByRole("region", { name: `Unidade ${n}` })).toContainText(label);
    // Marca a página: se ela recarregar, a marca some.
    await page.evaluate(() => {
      (globalThis as unknown as { semRecarregar?: boolean }).semRecarregar = true;
    });
  },
);

When(
  "o gestor marca a unidade {string} como {string} no CRM",
  async ({ org, people }, code: string, status: string) => {
    await org.person("Gestor", "org_admin");
    const crm = await people.page("Gestor");
    await crm.goto("/app/imoveis");
    await crm.getByLabel(`Status de ${code}`).selectOption({ label: status });
    await expect(crm.getByLabel(`Status de ${code}`)).toHaveValue(STATUS_VALUE[status] ?? "");
  },
);

Then(
  "o card da unidade {string} passa a mostrar {string} sem recarregar a página",
  async ({ page }, n: string, label: string) => {
    const card = page.getByRole("region", { name: `Unidade ${n}` });
    await expect(card).toContainText(label, { timeout: 15_000 });
    await expect(card.getByRole("link", { name: "Ver parecidas" })).toBeVisible();
    expect(
      await page.evaluate(
        () => (globalThis as unknown as { semRecarregar?: boolean }).semRecarregar,
      ),
    ).toBe(true);
  },
);

Given("um navegador sem suporte a WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext as unknown as (
      this: HTMLCanvasElement,
      id: string,
      ...args: unknown[]
    ) => RenderingContext | null;
    const patched = function (
      this: HTMLCanvasElement,
      id: string,
      ...args: unknown[]
    ): RenderingContext | null {
      // three.js só usa webgl2; bloquear os dois garante o fallback em qualquer versão.
      if (id === "webgl" || id === "webgl2" || id === "experimental-webgl") return null;
      return original.call(this, id, ...args);
    };
    HTMLCanvasElement.prototype.getContext = patched as typeof HTMLCanvasElement.prototype.getContext;
  });
});

Then("aparece a grade 2D de unidades com os mesmos status", async ({ page }) => {
  await expect(page.locator("canvas")).toHaveCount(0);
  const grid = page.getByRole("list", { name: "Unidades em 2D" });
  await expect(grid).toBeVisible();
  const expected = [
    ["401", "sold"],
    ["402", "reserved"],
    ["501", "available"],
    ["502", "available"],
  ] as const;
  for (const [n, status] of expected) {
    const unit = grid.getByRole("button", {
      name: `Unidade ${n}, ${STATUS_LABEL[status] ?? ""}`,
    });
    await expect(unit).toBeVisible();
    await expect(unit).toHaveAttribute("data-status", status);
  }
});

When("o visitante escolhe a unidade {string} na grade 2D", async ({ page }, n: string) => {
  await page
    .getByRole("list", { name: "Unidades em 2D" })
    .getByRole("button", { name: new RegExp(`^Unidade ${n},`) })
    .click();
});

Then(
  "a imagem estática do prédio já vem no HTML, antes do 3D",
  async ({ page, org, baseURL }) => {
    // Lê o documento cru (sem executar o JS) para provar que a prévia é servida antes do three.js.
    const response = await page.goto(org.siteUrl(baseURL ?? "http://localhost:3100"), {
      waitUntil: "commit",
    });
    const html = (await response?.text()) ?? "";
    expect(html).toContain('data-building-preview="true"');
    expect(html).not.toContain("<canvas");
  },
);

Then("o prédio 3D aparece depois de carregar", async ({ page }) => {
  const viewer = page.getByRole("img", { name: /Prédio em 3D/ });
  await expect(viewer.locator("canvas")).toBeVisible({ timeout: 20_000 });
});
