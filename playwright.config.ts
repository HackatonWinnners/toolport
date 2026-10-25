import { defineConfig, devices } from "@playwright/test";
import { GATEWAY_URL, WEB_PORT } from "./e2e/env";

/**
 * Toolport end-to-end tests (S1–S7 in the MVP plan).
 *
 * Prerequisites (this config does NOT start them, and the tests never stop them):
 *   - the gateway on http://localhost:4021 (`npm run dev:gateway`), seeded with Stellar Oracle
 *   - the demo MCP server on http://localhost:4022 (`npm run dev:demo`)
 *   - .wallets/agent.json (or STELLARPAY_WALLET) holding a funded testnet agent wallet, for S4
 *
 * The web app is built and served on 3104 with the e2e signer compiled in
 * (NEXT_PUBLIC_E2E_SIGNER=true, see apps/web/lib/signer.ts). That build must never be deployed.
 * A server already listening on 3104 is reused; make sure it is an e2e-signer build.
 *
 *   npm run e2e                       # everything, including S4 (spends 0.02 testnet USDC)
 *   npm run e2e -- --grep-invert @paid  # everything except the real payment
 *   npm run e2e -- --grep @paid         # S4 alone
 */
const PORT = WEB_PORT;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build -w @stellarpay/web && npm exec -w @stellarpay/web -- next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_E2E_SIGNER: "true",
      NEXT_PUBLIC_GATEWAY_URL: GATEWAY_URL,
    },
  },
});
