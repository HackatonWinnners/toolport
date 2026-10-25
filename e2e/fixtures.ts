import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect, type Page, type Request } from "@playwright/test";
import { createEd25519Signer } from "@x402/stellar";
import { GATEWAY_URL, NETWORK, TESTNET_PASSPHRASE } from "./env";

export { expect };

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

interface Wallet {
  publicKey: string;
  secretKey: string;
}

/** The agent wallet, read in Node only. The secret never reaches the browser or the logs. */
function loadAgentWallet(): Wallet {
  const file = resolve(REPO_ROOT, process.env.STELLARPAY_WALLET ?? ".wallets/agent.json");
  const json = JSON.parse(readFileSync(file, "utf8")) as Partial<Wallet>;
  if (typeof json.publicKey !== "string" || typeof json.secretKey !== "string") {
    throw new Error(`${file} has no publicKey/secretKey`);
  }
  return { publicKey: json.publicKey, secretKey: json.secretKey };
}

export const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

export interface E2ESignerHandle {
  address: string;
  /** How many auth entries the page asked the test wallet to sign. */
  signCalls(): number;
}

/**
 * Installs the e2e signer seam from apps/web/lib/signer.ts: the page sees
 * window.__toolportE2E = { address, networkPassphrase, sign }, and sign() round-trips to Node,
 * where createEd25519Signer signs the auth-entry preimage with the agent secret.
 * Only works against a build with NEXT_PUBLIC_E2E_SIGNER=true (playwright.config.ts does that).
 */
export async function installE2ESigner(page: Page): Promise<E2ESignerHandle> {
  const wallet = loadAgentWallet();
  const signer = createEd25519Signer(wallet.secretKey, NETWORK);
  let calls = 0;
  await page.exposeFunction(
    "__toolportSign",
    async (preimageXdr: string, opts?: { networkPassphrase?: string; address?: string }) => {
      calls += 1;
      const signed = await signer.signAuthEntry(preimageXdr, opts);
      return { signedAuthEntry: signed.signedAuthEntry, signerAddress: signed.signerAddress };
    },
  );
  await page.addInitScript(
    ({ address, networkPassphrase }) => {
      const w = window as unknown as {
        __toolportSign: (xdr: string, opts?: unknown) => Promise<unknown>;
        __toolportE2E: unknown;
      };
      w.__toolportE2E = {
        address,
        networkPassphrase,
        sign: (preimageXdr: string, opts?: unknown) => w.__toolportSign(preimageXdr, opts),
      };
    },
    { address: wallet.publicKey, networkPassphrase: TESTNET_PASSPHRASE },
  );
  return { address: wallet.publicKey, signCalls: () => calls };
}

const PAYMENT_HEADERS = ["x-payment", "payment-signature"];
const MCP_PAYMENT_META_KEY = "x402/payment"; // @x402/mcp puts the payment payload in params._meta[this]

/** True when a request carries an x402 payment: an HTTP payment header or an MCP tools/call _meta payload. */
export function carriesPayment(req: Request): boolean {
  const headers = req.headers();
  if (PAYMENT_HEADERS.some((h) => h in headers)) return true;
  const body = req.postData();
  if (!body) return false;
  try {
    const parsed = JSON.parse(body) as unknown;
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    return messages.some((m) => {
      const meta = (m as { params?: { _meta?: Record<string, unknown> } } | null)?.params?._meta;
      return meta != null && MCP_PAYMENT_META_KEY in meta;
    });
  } catch {
    return body.includes(`"${MCP_PAYMENT_META_KEY}"`);
  }
}

export interface PageWatch {
  /** Requests that carried an x402 payment. */
  payments: Request[];
  /** Console errors and uncaught page errors. */
  errors: string[];
  /** Uncaught page errors only (a crash, as opposed to a logged failure). */
  crashes: string[];
}

type Fixtures = {
  watch: PageWatch;
  signer: E2ESignerHandle;
};

export const test = base.extend<Fixtures>({
  watch: async ({ page }, use) => {
    const watch: PageWatch = { payments: [], errors: [], crashes: [] };
    page.on("request", (req) => {
      if (carriesPayment(req)) watch.payments.push(req);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") watch.errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      watch.errors.push(err.message);
      watch.crashes.push(err.message);
    });
    await use(watch);
  },
  signer: async ({ page }, use) => {
    await use(await installE2ESigner(page));
  },
});

export interface CatalogServer {
  id: string;
  name: string;
  tools: { name: string; priceUsd: string; paid: boolean }[];
}

/** The live catalog straight from the gateway, to build ?tool=<serverId>:<name> links. */
export async function oracleServer(): Promise<CatalogServer> {
  const res = await fetch(`${GATEWAY_URL}/api/servers`);
  if (!res.ok) throw new Error(`gateway /api/servers: HTTP ${res.status}`);
  const { servers } = (await res.json()) as { servers: CatalogServer[] };
  const oracle = servers.find((s) => s.name === "Stellar Oracle");
  if (!oracle) throw new Error("Stellar Oracle is not seeded on the gateway");
  return oracle;
}
