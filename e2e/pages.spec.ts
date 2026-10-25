import { expect, oracleServer, test } from "./fixtures";

// S6 Pages. The redirect and nav checks run on WP-0's shell; catalog-server and seller-connect
// need WP-C, and the "Try in playground" preselect needs WP-B.

test.describe("S6 pages", () => {
  test("S6 /registry redirects to /catalog", async ({ page }) => {
    await page.goto("/registry");
    await expect(page).toHaveURL(/\/catalog$/);
  });

  test("S6 every app-nav link resolves", async ({ page, request, watch }) => {
    await page.goto("/playground");
    const nav = page.getByTestId("app-nav");
    await expect(nav).toBeVisible();
    const hrefs = await nav.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
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

  test("S6 Try in playground preselects the tool", async ({ page }) => {
    const oracle = await oracleServer();
    await page.goto("/catalog");
    const card = page.getByTestId("catalog-server").filter({ hasText: "Stellar Oracle" });
    await card.getByRole("link", { name: /Try in playground/i }).first().click();
    await expect(page).toHaveURL(/\/playground\?.*tool=/);
    const param = new URL(page.url()).searchParams.get("tool") ?? "";
    const [serverId, toolName] = param.split(":");
    expect(serverId).toBe(oracle.id);
    expect(oracle.tools.map((t) => t.name)).toContain(toolName);
    await expect(page.locator(`[data-testid="tool-option"][data-tool="${toolName}"]`)).toHaveAttribute("aria-checked", "true");
  });

  test("S6 /dashboard shows seller-connect", async ({ page, watch }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("seller-connect")).toBeVisible();
    expect(watch.errors).toEqual([]);
  });
});
