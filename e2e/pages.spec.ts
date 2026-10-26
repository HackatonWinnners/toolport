import { expect, oracleServer, test } from "./fixtures";

// S6 Pages. The redirect and nav checks run on WP-0's shell; catalog-server and seller-connect
// need WP-C.

test.describe("S6 pages", () => {
  test("S6 /registry redirects to /catalog", async ({ page }) => {
    await page.goto("/registry");
    await expect(page).toHaveURL(/\/catalog$/);
  });

  test("S6 /playground redirects to connecting an agent", async ({ page }) => {
    await page.goto("/playground");
    await expect(page).toHaveURL(/\/#connect$/);
    await expect(page.locator("#connect")).toBeVisible();
  });

  test("S6 /activity redirects to /catalog", async ({ page }) => {
    await page.goto("/activity");
    await expect(page).toHaveURL(/\/catalog$/);
  });

  test("S6 every app-nav link resolves", async ({ page, request, watch }) => {
    await page.goto("/catalog");
    const nav = page.getByTestId("app-nav");
    await expect(nav).toBeVisible();
    const hrefs = await nav.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    expect(hrefs.some((h) => h.includes("/playground") || h.includes("/activity"))).toBe(false);
    for (const href of hrefs) {
      const res = await request.get(href);
      expect(res.status(), href).toBeLessThan(400);
    }
    // Same-origin links also render client-side without errors.
    const origin = new URL(page.url()).origin;
    for (const href of hrefs.filter((h) => h.startsWith(origin))) {
      await page.goto(href);
      await expect(page.getByTestId("app-nav")).toBeVisible();
    }
    expect(watch.errors).toEqual([]);
  });

  test("S6 catalog lists Stellar Oracle with prices", async ({ page, watch }) => {
    const oracle = await oracleServer();
    await page.goto("/catalog");
    const card = page.getByTestId("catalog-server").filter({ hasText: "Stellar Oracle" });
    await expect(card).toHaveCount(1);
    for (const tool of oracle.tools.filter((t) => t.paid)) {
      await expect(card).toContainText(`$${Number(tool.priceUsd).toFixed(2)}`);
    }
    expect(watch.errors).toEqual([]);
  });

  test("S6 catalog tools point to connecting an agent", async ({ page }) => {
    await page.goto("/catalog");
    const card = page.getByTestId("catalog-server").filter({ hasText: "Stellar Oracle" });
    await expect(card.locator('a[href*="/playground"]')).toHaveCount(0);
    await card.getByRole("link", { name: /Use it from your agent/i }).first().click();
    await expect(page).toHaveURL(/\/#connect$/);
    await expect(page.getByTestId("connect-config")).toBeVisible();
  });

  test("S6 /dashboard shows seller-connect", async ({ page, watch }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("seller-connect")).toBeVisible();
    expect(watch.errors).toEqual([]);
  });
});
