import type { APIRequestContext, Page } from "@playwright/test";
import { HORIZON_URL, GATEWAY_URL } from "./env";
import { expect, oracleServer, shortAddress, test } from "./fixtures";

// S2–S5 need WP-B's playground (test ids from plan §4.4). S7 works with any playground that
// renders <ErrorNote> (data-testid="error-note") when the gateway is unreachable.

const SWAP = "swap XLM for USDC";

/** Ask in plain words and wait for the router to preselect dex_best_path with its arguments. */
async function askForSwap(page: Page) {
  await page.goto("/playground");
  await page.getByTestId("ask-input").fill(SWAP);
  await page.getByTestId("ask-submit").click();
  await expect(page.getByTestId("user-bubble").last()).toContainText(SWAP);
  const option = page.locator('[data-testid="tool-option"][data-tool="dex_best_path"]');
  await expect(option).toHaveAttribute("role", "radio");
  await expect(option).toHaveAttribute("aria-checked", "true");
  return option;
}

const argInput = (page: Page, name: string) => page.locator(`[data-testid="arg-input"][name="${name}"]`);

/** The budget inputs may sit behind the budget pill; open it first when they are hidden. */
async function budgetInput(page: Page, id: "budget-total-input" | "budget-percall-input") {
  const input = page.getByTestId(id);
  if (!(await input.isVisible())) await page.getByTestId("budget-pill").click();
  await expect(input).toBeVisible();
  return input;
}

/** First dollar or plain decimal amount in a string, e.g. "$0.98 left" -> 0.98. */
function firstAmount(text: string): number {
  const m = text.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`no amount in ${JSON.stringify(text)}`);
  return Number(m[1]);
}

async function horizonTransaction(request: APIRequestContext, hash: string) {
  const res = await request.get(`${HORIZON_URL}/transactions/${hash}`);
  if (!res.ok()) return { status: res.status(), successful: undefined };
  const body = (await res.json()) as { successful?: boolean };
  return { status: res.status(), successful: body.successful };
}

test.describe.skip("playground (unrouted while it is on the roadmap)", () => {
  test("S2 quote: price said out loud, nothing signed", async ({ page, watch, signer }) => {
    const option = await askForSwap(page);
    await expect(option).toContainText("$0.02");
    await expect(argInput(page, "from")).toHaveValue("XLM");
    await expect(argInput(page, "to")).toHaveValue("USDC");
    await expect(argInput(page, "amount")).toHaveValue("100");

    await page.getByTestId("get-price").click();
    const quote = page.locator('[data-testid="quote-text"][data-state="ok"]');
    await expect(quote).toContainText("$0.02");
    await expect(quote).toContainText("Nothing signed");
    await expect(page.getByTestId("pay-run")).toHaveText(/Pay \$0\.02 and run/);

    expect(signer.signCalls(), "the wallet was asked to sign").toBe(0);
    expect(watch.payments.map((r) => r.url()), "a request carried an x402 payment").toEqual([]);
  });

  test("S3 over-cap refusal: per-call cap below the price", async ({ page, watch, signer }) => {
    await askForSwap(page);
    const perCall = await budgetInput(page, "budget-percall-input");
    await perCall.fill("0.01");
    await perCall.blur();

    await page.getByTestId("get-price").click();
    await expect(page.locator('[data-testid="quote-text"][data-state="refused"]')).toBeVisible();
    await expect(page.getByTestId("pay-run")).toBeDisabled();

    expect(signer.signCalls(), "the wallet was asked to sign").toBe(0);
    expect(watch.payments.map((r) => r.url()), "a request carried an x402 payment").toEqual([]);
  });

  // Spends 0.02 testnet USDC from the agent wallet. Run alone with: npm run e2e -- --grep @paid
  test("S4 paid end to end on testnet", { tag: "@paid" }, async ({ page, signer, request }) => {
    test.setTimeout(120_000);
    await askForSwap(page);

    const walletButton = page.getByTestId("wallet-button");
    if (!(await walletButton.textContent())?.includes(shortAddress(signer.address))) await walletButton.click();
    await expect(walletButton).toContainText(shortAddress(signer.address));
    await expect(walletButton).toContainText(/(\$\s*\d+(\.\d+)?|\d+(\.\d+)?\s*USDC)/);

    const budgetBefore = firstAmount((await page.getByTestId("budget-pill").textContent()) ?? "");
    const runsBefore = await page.getByTestId("run-item").count();

    await page.getByTestId("get-price").click();
    await expect(page.locator('[data-testid="quote-text"][data-state="ok"]')).toContainText("$0.02");
    await page.getByTestId("pay-run").click();

    const steps = page.getByTestId("progress-step");
    await expect(steps.first()).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(() => steps.evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute("data-done") === "true")), {
        timeout: 30_000,
      })
      .toBe(true);

    await expect(page.getByTestId("result-headline")).toHaveText(/^Receive [\d.]+ USDC$/);
    await expect(page.getByTestId("receipt")).toContainText("Paid $0.02");
    expect(signer.signCalls()).toBeGreaterThan(0);

    const href = (await page.getByTestId("receipt-tx").getAttribute("href")) ?? "";
    const hash = href.match(/[0-9a-f]{64}/)?.[0];
    expect(hash, `receipt-tx href ${href}`).toBeTruthy();
    await expect
      .poll(async () => (await horizonTransaction(request, hash!)).successful, { timeout: 30_000, intervals: [1_000, 2_000, 5_000] })
      .toBe(true);

    await expect(page.getByTestId("run-item")).toHaveCount(runsBefore + 1);
    await expect(page.getByTestId("run-item").filter({ hasText: "$0.02 · settled" })).toHaveCount(1);

    await expect
      .poll(async () => firstAmount((await page.getByTestId("budget-pill").textContent()) ?? ""))
      .toBeCloseTo(budgetBefore - 0.02, 5);
  });

  test("S5 free tool: ping runs with no wallet", async ({ page, watch }) => {
    const oracle = await oracleServer();
    await page.goto(`/playground?tool=${encodeURIComponent(`${oracle.id}:ping`)}`);
    await expect(page.locator('[data-testid="tool-option"][data-tool="ping"]')).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("pay-run").click();
    await expect(page.getByTestId("result-headline")).toHaveText("pong");
    await expect(page.getByTestId("receipt-tx")).toHaveCount(0);
    expect(watch.payments.map((r) => r.url())).toEqual([]);
  });

  // Never stops the shared gateway: the browser's requests to it are aborted instead.
  test("S7 gateway down: error note, no crash", async ({ page, watch }) => {
    await page.route(`${GATEWAY_URL}/**`, (route) => route.abort("connectionrefused"));
    await page.goto("/playground");
    await expect(page.getByTestId("error-note").first()).toBeVisible();
    await expect(page.getByTestId("app-nav")).toBeVisible();
    expect(watch.crashes, "uncaught page errors").toEqual([]);
  });
});
