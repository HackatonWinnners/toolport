/**
 * Sign in to a gateway as the provider (SEP-53 signature, like Freighter) and register + price
 * an upstream MCP server. Idempotent: an upstream that is already registered is reused.
 *   STELLARPAY_WALLET=.wallets/provider.json npx tsx scripts/seed-gateway.ts <gateway-url> <upstream-mcp-url>
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Keypair } from "@stellar/stellar-sdk";

const [gateway, upstreamUrl] = process.argv.slice(2).map((u) => u?.replace(/\/$/, ""));
if (!gateway || !upstreamUrl) {
  console.error("usage: tsx scripts/seed-gateway.ts <gateway-url> <upstream-mcp-url>");
  process.exit(1);
}
const wallet = JSON.parse(await readFile(process.env.STELLARPAY_WALLET ?? ".wallets/provider.json", "utf8"));
const keypair = Keypair.fromSecret(wallet.secretKey);
const address = keypair.publicKey();

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(`${gateway}${path}`, { ...init, headers });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${JSON.stringify(body)}`);
  return body as T;
}

const { message } = await api<{ message: string }>("/api/auth/challenge", {
  method: "POST",
  body: JSON.stringify({ address }),
});
const digest = createHash("sha256").update(`Stellar Signed Message:\n${message}`).digest();
const { token } = await api<{ token: string }>("/api/auth/verify", {
  method: "POST",
  body: JSON.stringify({ address, message, signature: keypair.sign(digest).toString("base64") }),
});
console.log(`signed in as ${address}`);

const { servers } = await api<{ servers: { id: string; upstreamUrl?: string; mcpUrl: string }[] }>(
  "/api/servers?mine=true",
  { token },
);
const existing = servers.find((s) => s.upstreamUrl === upstreamUrl);
const server =
  existing ??
  (await api<{ id: string; mcpUrl: string }>("/api/servers", {
    method: "POST",
    token,
    body: JSON.stringify({
      upstreamUrl,
      name: "Stellar Oracle",
      description: "Live Stellar data for agents: account summaries and best DEX swap paths.",
      prices: { account_summary: "$0.01", dex_best_path: "$0.02" },
    }),
  }));
console.log(`${existing ? "already registered" : "registered"} ${server.id}`);
console.log(`paid MCP url: ${server.mcpUrl}`);
