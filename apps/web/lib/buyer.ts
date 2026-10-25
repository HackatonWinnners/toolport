"use client";

// In-browser buyer: the same x402 flow the agent router runs, signed by the user's Freighter wallet.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { x402Client } from "@x402/core/client";
import { x402MCPClient } from "@x402/mcp";
import { getUsdcAddress } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { NETWORK, type Server } from "./api";

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const USDC = getUsdcAddress(NETWORK as `${string}:${string}`);
const STORAGE_KEY = "stellarpay.agent";
const UNITS = 10_000_000;

export interface CatalogTool {
  id: string;
  name: string;
  description: string;
  serverId: string;
  serverName: string;
  mcpUrl: string;
  priceUnits: number;
  inputSchema: { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
}

export interface Quote {
  amountUnits: number;
  payTo: string;
  network: string;
}

export interface Run {
  id: string;
  at: string;
  tool: string;
  args: Record<string, unknown>;
  amountUnits: number;
  status: "paid" | "free" | "refused" | "failed";
  text: string;
  tx?: string;
}

export interface Budget {
  capUnits: number;
  perCallUnits: number;
  spentUnits: number;
  runs: Run[];
}

export const usdc = (units: number) => `$${(units / UNITS).toFixed(units % 100_000 === 0 ? 2 : 4)}`;
export const toUnits = (usd: string) => Math.round(Number(usd) * UNITS);

/** Every enabled tool across the registry, flattened for search. */
export function catalogFrom(servers: Server[]): CatalogTool[] {
  return servers.flatMap((s) =>
    s.tools
      .filter((t) => t.enabled)
      .map((t) => ({
        id: `${s.id}:${t.name}`,
        name: t.name,
        description: t.description,
        serverId: s.id,
        serverName: s.name,
        mcpUrl: s.mcpUrl,
        priceUnits: Number(t.priceUnits),
        inputSchema: (t.inputSchema ?? {}) as CatalogTool["inputSchema"],
      })),
  );
}

/** Lexical search like the router's: name matches outrank description matches. */
export function searchCatalog(tools: CatalogTool[], query: string): CatalogTool[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return tools;
  const score = (t: CatalogTool) =>
    words.reduce((n, w) => n + (t.name.toLowerCase().includes(w) ? 4 : 0) + (`${t.description} ${t.serverName}`.toLowerCase().includes(w) ? 1 : 0), 0);
  return tools
    .map((t) => ({ t, s: score(t) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}

export function loadBudget(): Budget {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved.capUnits === "number") return saved;
  } catch {
    // storage blocked: start fresh
  }
  return { capUnits: toUnits("0.10"), perCallUnits: toUnits("0.05"), spentUnits: 0, runs: [] };
}

export function saveBudget(budget: Budget) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
  } catch {}
}

/** Why this price can't be paid under the budget, or null. */
export function refusal(budget: Budget, amountUnits: number): string | null {
  if (amountUnits > budget.perCallUnits) return `${usdc(amountUnits)} is above the per-call cap of ${usdc(budget.perCallUnits)}`;
  if (budget.spentUnits + amountUnits > budget.capUnits) {
    return `${usdc(amountUnits)} would exceed the budget (${usdc(budget.spentUnits)} of ${usdc(budget.capUnits)} spent)`;
  }
  return null;
}

async function connect(url: string) {
  const client = new Client({ name: "stellarpay-web", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

/** Ask for the price without paying: an unpaid call to a priced tool returns the x402 challenge. */
export async function quote(tool: CatalogTool, args: Record<string, unknown>): Promise<Quote> {
  const client = await connect(tool.mcpUrl);
  try {
    const result = await client.callTool({ name: tool.name, arguments: args });
    const accepts = (result.structuredContent as { accepts?: { amount: string; payTo: string; network: string; asset: string }[] })
      ?.accepts;
    const option = accepts?.find((a) => a.network === NETWORK && a.asset === USDC);
    if (!result.isError || !option) throw new Error("The provider did not return a USDC price for this tool");
    return { amountUnits: Number(option.amount), payTo: option.payTo, network: option.network };
  } finally {
    await client.close();
  }
}

/**
 * Freighter's signAuthEntry signs the hash of the auth-entry preimage and hands back the raw signature
 * (https://developers.stellar.org/docs/build/guides/freighter/sign-auth-entries), sometimes as a Buffer
 * serialized to { type: "Buffer", data }. stellar-sdk's signAuthEntries wants that signature as base64.
 */
function signatureToBase64(signed: unknown): string {
  let bytes: Uint8Array;
  if (typeof signed === "string") return signed;
  if (signed instanceof Uint8Array) bytes = signed;
  else if (signed && typeof signed === "object" && Array.isArray((signed as { data?: unknown }).data)) {
    bytes = Uint8Array.from((signed as { data: number[] }).data);
  } else throw new Error("Freighter returned an unexpected signature format");
  if (bytes.length !== 64) throw new Error(`Freighter returned ${bytes.length} bytes, expected a 64-byte ed25519 signature`);
  return btoa(String.fromCharCode(...bytes));
}

/** Freighter as an x402 Stellar signer: it signs the Soroban auth entry for the USDC transfer. */
async function freighterSigner(address: string) {
  const freighter = await import("@stellar/freighter-api");
  return {
    address,
    signAuthEntry: async (preimageXdr: string, opts?: { networkPassphrase?: string }) => {
      const signed = await freighter.signAuthEntry(preimageXdr, { networkPassphrase: opts?.networkPassphrase, address });
      if (signed.error || !signed.signedAuthEntry) throw new Error(signed.error?.message ?? "Signature rejected in Freighter");
      return { signedAuthEntry: signatureToBase64(signed.signedAuthEntry), signerAddress: signed.signerAddress };
    },
  };
}

/** Call a tool, paying with Freighter if it's priced, but never above the budget. */
export async function invoke(
  tool: CatalogTool,
  args: Record<string, unknown>,
  address: string,
  budget: Budget,
): Promise<Omit<Run, "id" | "at" | "tool" | "args">> {
  let approvedUnits = 0;
  let denial: string | null = null;
  const payments = new x402Client().register(NETWORK as `${string}:${string}`, new ExactStellarScheme(await freighterSigner(address), { url: RPC_URL }));
  const mcp = new x402MCPClient(new Client({ name: "stellarpay-web", version: "0.1.0" }), payments, {
    autoPayment: true,
    onPaymentRequested: ({ paymentRequired }) => {
      const option = paymentRequired.accepts.find((a) => a.network === NETWORK && a.asset === USDC);
      denial = option ? refusal(budget, Number(option.amount)) : "No USDC payment option";
      if (denial || approvedUnits > 0) return false; // one payment per call, never an automatic second one
      approvedUnits = Number(option!.amount);
      return true;
    },
  });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(tool.mcpUrl)));
  try {
    const result = await mcp.callTool(tool.name, args);
    const text = (result.content as { type: string; text?: string }[])
      .map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
      .join("\n");
    if (result.paymentMade && result.paymentResponse?.success) {
      return { status: "paid", amountUnits: approvedUnits, text, tx: result.paymentResponse.transaction };
    }
    return { status: result.isError ? "failed" : "free", amountUnits: 0, text };
  } catch (error) {
    if (denial) return { status: "refused", amountUnits: 0, text: denial };
    return { status: "failed", amountUnits: 0, text: error instanceof Error ? error.message : String(error) };
  } finally {
    await mcp.close();
  }
}
