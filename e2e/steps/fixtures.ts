import type { Browser, Page } from "@playwright/test";
import { createBdd, test as base } from "playwright-bdd";
import { TestOrg } from "../support/test-org";

/** Uma aba logada por pessoa do cenário (cada uma com o próprio contexto e cookies). */
class People {
  private readonly pages = new Map<string, Page>();
  constructor(
    private readonly browser: Browser,
    private readonly org: TestOrg,
    private readonly baseURL: string,
  ) {}

  async page(name: string): Promise<Page> {
    const existing = this.pages.get(name);
    if (existing) return existing;
    const context = await this.browser.newContext({
      baseURL: this.baseURL,
      viewport: { width: 1400, height: 900 },
    });
    const page = await context.newPage();
    const hash = await this.org.magicLinkHash(name);
    await page.goto(`/auth/confirm?token_hash=${hash}&type=magiclink`);
    await page.waitForURL(/\/app/);
    this.pages.set(name, page);
    return page;
  }

  async close(): Promise<void> {
    for (const page of this.pages.values()) await page.context().close();
  }
}

export const test = base.extend<{ org: TestOrg; people: People }>({
  org: async ({}, use) => {
    const org = new TestOrg();
    await org.create();
    await use(org);
    await org.cleanup();
  },
  people: async ({ browser, org, baseURL }, use) => {
    const people = new People(browser, org, baseURL ?? "http://localhost:3100");
    await use(people);
    await people.close();
  },
});

export const { Given, When, Then } = createBdd(test);
