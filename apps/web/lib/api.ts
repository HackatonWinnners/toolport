export const GATEWAY_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4021").replace(/\/$/, "");
export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "stellar:testnet";
export const EXPLORER = NETWORK === "stellar:pubnet"
  ? "https://stellar.expert/explorer/public"
  : "https://stellar.expert/explorer/testnet";

export interface Tool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown> | null;
  priceUnits: string;
  priceUsd: string;
  paid: boolean;
  enabled: boolean;
}

export interface Server {
  id: string;
  name: string;
  description: string;
  owner: string;
  payTo: string;
  network: string;
  listed: boolean;
  upstreamUrl?: string;
  mcpUrl: string;
  createdAt: string;
  tools: Tool[];
}

export interface Call {
  id: string;
  tool: string;
  payer: string | null;
  amountUsd: string;
  status: "free" | "paid" | "verify_failed" | "tool_failed" | "settle_failed" | "payment_unknown";
  txHash: string | null;
  explorerUrl: string | null;
  error: string | null;
  latencyMs: number;
  createdAt: string;
}

export interface Stats {
  calls: number;
  paidCalls: number;
  payers: number;
  revenueUsd: string;
  byTool: { tool: string; calls: number; paidCalls: number; failedCalls: number; revenueUsd: string; avgLatencyMs: number }[];
}

export interface AccountStatus {
  address: string;
  exists: boolean;
  xlm: string;
  usdc: string | null;
  hasUsdcTrustline: boolean;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const usd = (value: string | number) => {
  const n = Number(value);
  return n === 0 ? "free" : n < 0.01 ? `$${n.toString()}` : `$${n.toFixed(2)}`;
};

export const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/**
 * The `stellarpay` npm name isn't ours yet, so never suggest `npx stellarpay`: whoever registers
 * it would run next to the agent's wallet secret. Point NEXT_PUBLIC_CLI_PATH at a checkout's
 * packages/cli/bin/stellarpay.js; set NEXT_PUBLIC_CLI_NPM=true once the package is published.
 */
const CLI_PATH = process.env.NEXT_PUBLIC_CLI_PATH ?? "/absolute/path/to/stellarpay-mcp/packages/cli/bin/stellarpay.js";
const CLI_NPM = process.env.NEXT_PUBLIC_CLI_NPM === "true";

export function claudeDesktopConfig(urls: string[]) {
  const bridgeArgs = ["connect", "--urls", urls.join(","), "--max-per-call", "0.05", "--budget", "1"];
  return JSON.stringify(
    {
      mcpServers: {
        stellarpay: CLI_NPM
          ? { command: "npx", args: ["-y", "stellarpay", ...bridgeArgs] }
          : { command: "node", args: [CLI_PATH, ...bridgeArgs] },
      },
    },
    null,
    2,
  );
}

/** Claude Desktop config for the discovery router: one MCP for every tool in the catalog, under a budget. */
export function routerConfig() {
  const args = ["router", "--max-per-call", "0.05", "--budget", "1", "--session", "claude"];
  return JSON.stringify(
    {
      mcpServers: {
        stellarpay: CLI_NPM ? { command: "npx", args: ["-y", "stellarpay", ...args] } : { command: "node", args: [CLI_PATH, ...args] },
      },
    },
    null,
    2,
  );
}
