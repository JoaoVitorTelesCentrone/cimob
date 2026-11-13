import { expect } from "@playwright/test";
import { Given, Then, When } from "./fixtures";

Given(
  "uma imobiliária de teste com o site do {string} publicado e WhatsApp {string}",
  async ({ org }, development: string, whatsapp: string) => {
    await org.publishSite({
      development,
      whatsapp,
      units: [
        {
          code: "T-101",
          floor: 1,
          position: "01",
          bedrooms: 2,
          area: 58,
          price: 520000,
          status: "available",
        },
        {
          code: "T-102",
          floor: 1,
          position: "02",
          bedrooms: 3,
          area: 82,
          price: 765000,
          status: "available",
        },
        {
          code: "T-201",
          floor: 2,
          position: "01",
          bedrooms: 3,
          area: 120,
          price: 990000,
          status: "sold",
        },
      ],
    });
  },
);

Given(
  "o empreendimento {string} não publicado da mesma imobiliária",
  async ({ org }, development: string) => {
    await org.publishSite({ development, whatsapp: "5511900000000", published: false });
  },
);

When("o visitante abre o site da imobiliária", async ({ page, org, baseURL }) => {
  await page.goto(org.siteUrl(baseURL ?? "http://localhost:3100"));
});

Then("vê o título {string}", async ({ page }, title: string) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
});

Then("vê {string} e {string}", async ({ page }, a: string, b: string) => {
  await expect(page.getByText(a, { exact: true })).toBeVisible();
  await expect(page.getByText(b, { exact: true })).toBeVisible();
});

Then(
  "o botão {string} abre o WhatsApp {string} falando do {string}",
  async ({ page }, label: string, phone: string, development: string) => {
    const href = await page.getByRole("link", { name: new RegExp(label) }).getAttribute("href");
    const url = new URL(href ?? "");
    expect(url.host).toBe("wa.me");
    expect(url.pathname).toBe(`/${phone}`);
    expect(url.searchParams.get("text")).toContain(development);
  },
);

Then("o rodapé mostra {string}", async ({ page }, text: string) => {
  await expect(page.getByRole("contentinfo")).toContainText(text);
});

Then("não vê {string}", async ({ page }, text: string) => {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(text)).toHaveCount(0);
});

Then(
  "vê o prédio em 3D com {int} unidades em {int} andares",
  async ({ page }, units: number, floors: number) => {
    const viewer = page.getByRole("img", { name: /Prédio em 3D/ });
    await expect(viewer).toHaveAttribute("data-units", String(units), { timeout: 15_000 });
    await expect(viewer).toHaveAttribute("data-floors", String(floors));
    await expect(viewer.locator("canvas")).toBeVisible();
  },
);
