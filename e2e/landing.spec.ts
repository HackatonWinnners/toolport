import { expect, test } from "./fixtures";

// S1 Landing. Needs WP-A's landing (the stub only has hero-title and nav-open-app).

const activeStep = (page: import("@playwright/test").Page) =>
  page.getByTestId("how-step").evaluateAll((steps) => steps.findIndex((s) => s.getAttribute("aria-current") === "step"));

test.describe("S1 landing", () => {
  test("S1 title and hero", async ({ page, watch }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Toolport/);
    await expect(page.getByTestId("hero-title")).toHaveText("Your agent can buy the tools it needs.");
    expect(watch.errors).toEqual([]);
  });

  test("S1 dark theme and Geist font", async ({ page }) => {
    await page.goto("/");
    const body = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { background: s.backgroundColor, font: s.fontFamily };
    });
    expect(body.background).toBe("rgb(27, 26, 23)");
    expect(body.font).toMatch(/Geist/i);
  });

  test("S1 section anchors scroll", async ({ page }) => {
    await page.goto("/");
    for (const id of ["how", "proof", "catalog", "sell"]) {
      await page.locator(`a[href="#${id}"], a[href="/#${id}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  });

  test("S1 how-it-works advances and pauses", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("how-step")).toHaveCount(6);
    const first = await activeStep(page);
    expect(first).toBeGreaterThanOrEqual(0);
    await expect.poll(() => activeStep(page), { timeout: 3_000 }).not.toBe(first);

    const pause = page.getByTestId("how-pause");
    const before = await pause.getAttribute("aria-pressed");
    await pause.click();
    await expect(pause).not.toHaveAttribute("aria-pressed", before ?? "false");
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    const paused = await activeStep(page);
    await page.waitForTimeout(4_000);
    expect(await activeStep(page)).toBe(paused);
  });

  test("S1 proof rows link real testnet transactions", async ({ page }) => {
    await page.goto("/");
    const rows = page.getByTestId("proof-row");
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    const links = await page
      .locator('[data-testid="proof-row"] a[href*="/tx/"]')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    // Refused / stored rows have no transaction, so only the settled ones carry a link.
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const href of links) expect(href).toMatch(/stellar\.expert\/explorer\/testnet\/tx\/[0-9a-f]{64}/);
  });

  test("S1 first FAQ item is open", async ({ page }) => {
    await page.goto("/");
    const open = await page
      .getByTestId("faq-item")
      .first()
      .evaluate(
        (el) =>
          (el as HTMLDetailsElement).open === true ||
          el.getAttribute("aria-expanded") === "true" ||
          el.querySelector('[aria-expanded="true"]') !== null,
      );
    expect(open).toBe(true);
  });

  test("S1 nav-open-app goes to the playground", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-open-app").first().click();
    await expect(page).toHaveURL(/\/playground(\?|$)/);
  });

  test("S1 no horizontal scroll at 375px, screenshots", async ({ page, watch }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.screenshot({ path: testInfo.outputPath("landing-1440.png"), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
    await page.screenshot({ path: testInfo.outputPath("landing-375.png"), fullPage: true });
    await testInfo.attach("landing-1440", { path: testInfo.outputPath("landing-1440.png"), contentType: "image/png" });
    await testInfo.attach("landing-375", { path: testInfo.outputPath("landing-375.png"), contentType: "image/png" });
    expect(watch.errors).toEqual([]);
  });
});
