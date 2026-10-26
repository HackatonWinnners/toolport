import { usd } from "../apps/web/lib/api";
import { GATEWAY_URL } from "./env";
import { expect, oracleServer, test } from "./fixtures";

// S6 Pages. The redirect and nav checks run on WP-0's shell. The catalog is one grid: registry servers
// from the gateway first, then MPP Router APIs from public/catalog/mpprouter.json. seller-connect needs WP-C.

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

  test("S6 every site-nav link resolves", async ({ page, request, watch }) => {
    await page.goto("/catalog");
    const nav = page.getByTestId("site-nav");
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
      await expect(page.getByTestId("site-nav")).toBeVisible();
    }
    expect(watch.errors).toEqual([]);
  });

  test("S6 the same header on the landing and the app pages", async ({ page }) => {
    const snapshot = async (path: string) => {
      await page.goto(path);
      const nav = page.getByTestId("site-nav");
      await expect(nav).toBeVisible();
      return {
        links: await nav.locator("a").evaluateAll((as) => as.map((a) => `${a.textContent}→${a.getAttribute("href")}`)),
        active: await nav.locator('a[aria-current="page"]').allTextContents(),
        cta: await page.getByTestId("nav-open-app").getAttribute("href"),
      };
    };
    const landing = await snapshot("/");
    const catalog = await snapshot("/catalog");
    const sell = await snapshot("/dashboard");
    expect(catalog.links).toEqual(landing.links);
    expect(sell.links).toEqual(landing.links);
    expect([landing.cta, catalog.cta, sell.cta]).toEqual(["/#connect", "/#connect", "/#connect"]);
    expect(landing.active).toEqual([]);
    expect(catalog.active).toEqual(["Catalog"]);
    expect(sell.active).toEqual(["Sell"]);
    await expect(page.getByText("Testnet registry")).toHaveCount(0);
  });

  test("S6 catalog shows registry servers and MPP Router APIs in one grid", async ({ page, watch }) => {
    const oracle = await oracleServer();
    const paid = oracle.tools.filter((t) => t.paid).map((t) => Number(t.priceUsd));
    const hasFree = oracle.tools.some((t) => !t.paid);
    await page.goto("/catalog");
    const items = page.getByTestId("catalog-item");
    await expect(items.first()).toHaveAttribute("data-source", "registry");
    const card = items.filter({ hasText: "Stellar Oracle" });
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("data-source", "registry");
    await expect(card).toContainText(`${hasFree ? "free + " : ""}${usd(Math.min(...paid))}–${usd(Math.max(...paid))}/call`);
    await expect(page.getByTestId("catalog-count")).toHaveText(/^\d+ MCP servers? · \d+ APIs$/);
    await expect(card).not.toContainText(oracle.id);
    const mpp = page.locator('[data-testid="catalog-item"][data-source="mpp"]');
    expect(await mpp.count()).toBeGreaterThanOrEqual(12);
    const icon = mpp.getByTestId("catalog-icon").first();
    await expect(icon).toBeVisible();
    expect(await icon.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await card.getByRole("link", { name: /^Stellar Oracle: \d+ tools?$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/servers/${oracle.id}$`));
    expect(watch.errors).toEqual([]);
  });

  test("S6 one search covers registry tools and MPP Router APIs", async ({ page }) => {
    await page.goto("/catalog");
    const items = page.getByTestId("catalog-item");
    await expect(items.first()).toBeVisible();
    const search = page.getByRole("textbox", { name: "Search tools and APIs" });
    await search.fill("dex_best_path");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("Stellar Oracle");
    await search.fill("brave search");
    await expect(items.first()).toContainText("Brave Search");
    for (const text of await items.allTextContents()) expect(text).toContain("Brave Search");
  });

  test("S6 catalog shows MPP Router APIs while the gateway hangs", async ({ page }) => {
    await page.route(`${GATEWAY_URL}/**`, () => {});
    await page.goto("/catalog");
    await expect(page.locator('[data-testid="catalog-item"][data-source="mpp"]').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId("catalog-registry-pending")).toBeVisible();
    await expect(page.getByTestId("catalog-count")).toContainText("loading the registry");
  });

  test("S6 catalog explains when both sources are down", async ({ page }) => {
    await page.route(`${GATEWAY_URL}/**`, (route) => route.abort("connectionrefused"));
    await page.route("**/catalog/mpprouter.json", (route) => route.abort("connectionrefused"));
    await page.goto("/catalog");
    await expect(page.getByTestId("catalog-down")).toBeVisible();
    await expect(page.getByText(/Nothing matches/)).toHaveCount(0);
    await expect(page.getByTestId("catalog-item")).toHaveCount(0);
  });

  test("S6 catalog still lists MPP Router APIs when the gateway is down", async ({ page }) => {
    await page.route(`${GATEWAY_URL}/**`, (route) => route.abort("connectionrefused"));
    await page.goto("/catalog");
    await expect(page.getByTestId("catalog-partial")).toBeVisible();
    await expect(page.locator('[data-testid="catalog-item"][data-source="mpp"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="catalog-item"][data-source="registry"]')).toHaveCount(0);
  });

  test("S6 /dashboard shows seller-connect", async ({ page, watch }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("seller-connect")).toBeVisible();
    expect(watch.errors).toEqual([]);
  });
});
