import { parseArgs } from "node:util";
import { Keypair } from "@stellar/stellar-sdk";
import {
  AgentStore,
  verifySettlement,
  networkInfo,
  DEFAULT_NETWORK,
  addUsdcTrustline,
  buyUsdcWithXlm,
  explorerAccountUrl,
  explorerTxUrl,
  formatUsd,
  friendbot,
  getAccountStatus,
  isStellarNetworkId,
  type StellarNetwork,
} from "@stellarpay/core";
import { PaymentRefusedError, StellarPayClient } from "@stellarpay/mcp/client";
import { runBridge } from "./bridge.js";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { runRouter } from "./router.js";
import { loadWallet, resolveSecret, saveWallet, walletPath } from "./wallet.js";

const HELP = `stellarpay: pay for MCP tools with USDC on Stellar

Usage:
  stellarpay wallet create [--usdc 5]       New testnet wallet: keypair, Friendbot XLM, USDC trustline,
                                            optionally buy USDC on the testnet DEX
  stellarpay wallet show                    Address, XLM and USDC balances
  stellarpay wallet buy-usdc <amount>       Buy USDC with XLM on the DEX (testnet helper)
  stellarpay tools <url>                    List tools and prices of an MCP server
  stellarpay call <url> <tool> [json-args]  Call one tool, paying if needed
  stellarpay router [--gateway <url>] [--manifest <path>] [--bazaar <url>]
                                          Discovery MCP with quotes, durable runs and budgets
  stellarpay connect --urls <a,b>           Run a stdio MCP bridge for Claude Desktop / Cursor
  stellarpay budget [--reconcile] [--release <id>]
                                          Session spend and held payments; settle verified holds
                                          on-chain, or release one you know was never paid

Options:
  --secret S...          Wallet secret (default: STELLAR_SECRET_KEY or ~/.stellarpay/wallet.json)
  --network <id>         stellar:testnet (default) or stellar:pubnet
  --rpc-url <url>        Soroban RPC (required on pubnet)
  --max-per-call <usd>   Refuse any single call priced above this
  --budget <usd>         Persistent session budget (default 1 USDC)
  --session <name>       Resume this wallet/network budget (default default)
  --state-db <path>      Local state database (default next to wallet.json)
  --gateway <url>        StellarPay registry for router discovery
  --manifest <path>      Curated JSON tools; pubnet examples: catalog/mpprouter.mainnet.json
  --bazaar <url>         Rail402 discovery URL (testnet default: https://testnet.rail402.dev; "" for none)
  --allow-local         Allow loopback providers for local development
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    secret: { type: "string" },
    network: { type: "string" },
    "rpc-url": { type: "string" },
    urls: { type: "string" },
    "max-per-call": { type: "string" },
    budget: { type: "string" },
    usdc: { type: "string" },
    help: { type: "boolean", short: "h" },
    session: { type: "string" },
    "state-db": { type: "string" },
    gateway: { type: "string" },
    manifest: { type: "string" },
    bazaar: { type: "string" },
    "allow-local": { type: "boolean" },
    reconcile: { type: "boolean" },
    release: { type: "string" },
  },
});

const out = (...args: unknown[]) => console.log(...args);

function network(): StellarNetwork {
  const value = values.network ?? process.env.STELLAR_NETWORK ?? DEFAULT_NETWORK;
  if (!isStellarNetworkId(value)) throw new Error(`Unknown network ${value}`);
  return value;
}

function limits() {
  return {
    maxPerCall: values["max-per-call"] ?? process.env.STELLARPAY_MAX_PER_CALL ?? "0.05",
    budget: values.budget ?? process.env.STELLARPAY_BUDGET ?? "1",
  };
}

let store: AgentStore | undefined;
async function agentStore(secret: string) {
  if (!store) {
    const path = values["state-db"] ?? join(dirname(walletPath()), "agent.db");
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    store = await AgentStore.open({ url: pathToFileURL(path).href, network: network(), payer: Keypair.fromSecret(secret).publicKey(), session: values.session ?? "default", ...limits() });
  }
  return store;
}

async function client(url: string) {
  const secretKey = await resolveSecret(values.secret);
  const c = new StellarPayClient({
    secretKey,
    store: await agentStore(secretKey),
    verifyReceipts: true,
    network: network(),
    rpcUrl: values["rpc-url"] ?? process.env.STELLAR_RPC_URL,
    ...limits(),
  });
  await c.connect(url);
  return c;
}

async function walletCommand(sub: string | undefined) {
  const net = network();
  if (sub === "create") {
    if (net !== "stellar:testnet") throw new Error("wallet create only funds testnet wallets");
    const existing = await loadWallet();
    if (existing && !process.env.STELLARPAY_WALLET_OVERWRITE) {
      throw new Error(`A wallet already exists at ${walletPath()} (${existing.publicKey}). Set STELLARPAY_WALLET_OVERWRITE=1 to replace it.`);
    }
    const keypair = Keypair.random();
    out(`Creating ${keypair.publicKey()}`);
    await friendbot(keypair.publicKey());
    out("  funded with Friendbot XLM");
    await addUsdcTrustline(keypair.secret(), net);
    out("  USDC trustline added");
    if (values.usdc) {
      const hash = await buyUsdcWithXlm(keypair.secret(), values.usdc, net);
      out(`  bought ${values.usdc} USDC on the DEX: ${explorerTxUrl(hash, net)}`);
    }
    const path = await saveWallet({
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
      network: net,
      createdAt: new Date().toISOString(),
    });
    out(`Saved to ${path} (mode 600)`);
    if (!values.usdc) out("Get test USDC at https://faucet.circle.com (Stellar testnet) or run `stellarpay wallet buy-usdc 5`.");
    return;
  }
  const secret = await resolveSecret(values.secret);
  const address = Keypair.fromSecret(secret).publicKey();
  if (sub === "buy-usdc") {
    const amount = positionals[2];
    if (!amount) throw new Error("Usage: stellarpay wallet buy-usdc <amount>");
    const status = await getAccountStatus(address, net);
    if (!status.hasUsdcTrustline) await addUsdcTrustline(secret, net);
    const hash = await buyUsdcWithXlm(secret, amount, net);
    out(`Bought ${amount} USDC: ${explorerTxUrl(hash, net)}`);
    return;
  }
  if (sub === "show" || sub === undefined) {
    const status = await getAccountStatus(address, net);
    out(`Address  ${address}`);
    out(`Network  ${net}`);
    out(`XLM      ${status.exists ? status.xlm : "(account not funded)"}`);
    out(`USDC     ${status.hasUsdcTrustline ? status.usdc : "(no trustline)"}`);
    out(`Explorer ${explorerAccountUrl(address, net)}`);
    return;
  }
  throw new Error(`Unknown wallet command ${sub}`);
}

async function toolsCommand(url: string | undefined) {
  if (!url) throw new Error("Usage: stellarpay tools <url>");
  const c = await client(url);
  const { tools } = await c.listTools();
  for (const tool of tools) {
    const price = (tool._meta as any)?.["stellarpay/price"]?.usd ?? "free";
    out(`${tool.name.padEnd(28)} ${String(price).padEnd(8)} ${tool.description ?? ""}`);
  }
  await c.close();
}

async function callCommand(url: string | undefined, tool: string | undefined, rawArgs: string | undefined) {
  if (!url || !tool) throw new Error("Usage: stellarpay call <url> <tool> [json-args]");
  const c = await client(url);
  const started = Date.now();
  try {
    const result = await c.callTool(tool, rawArgs ? JSON.parse(rawArgs) : {});
    for (const item of result.content as any[]) out(item.type === "text" ? item.text : JSON.stringify(item));
    if (result.paymentMade && result.paymentResponse) {
      const r = result.paymentResponse;
      console.error(
        `\npaid ${formatUsd((result as { amountUnits?: bigint }).amountUnits ?? 0n)} from ${c.address} in ${((Date.now() - started) / 1000).toFixed(1)}s` +
          (r.success ? `\n${explorerTxUrl(r.transaction, c.network)}` : `\nsettlement failed: ${r.errorReason}`) +
          ((result as { paymentState?: string }).paymentState === "unverified"
            ? "\nnot yet visible on-chain: kept as pending; run `stellarpay budget --reconcile` later"
            : ""),
      );
    }
    if (result.isError) process.exitCode = 1;
  } catch (error) {
    if (error instanceof PaymentRefusedError) {
      console.error(error.message);
      process.exitCode = 2;
    } else throw error;
  } finally {
    await c.close();
  }
}

async function budgetCommand() {
  const secret = await resolveSecret(values.secret);
  const s = await agentStore(secret);
  const net = network();
  if (values.reconcile) {
    const rpcUrl = values["rpc-url"] ?? process.env.STELLAR_RPC_URL ?? networkInfo(net).rpcUrl;
    if (!rpcUrl) throw new Error("--reconcile needs --rpc-url on pubnet");
    const payer = Keypair.fromSecret(secret).publicKey();
    const settled = await s.reconcile((tx, amount) => verifySettlement(tx, rpcUrl, { network: net, payer, amount }));
    out(`reconciled: ${settled.length} hold(s) verified on-chain and settled`);
  }
  if (values.release) {
    if (!(await s.release(values.release))) throw new Error(`No open hold ${values.release} in this session`);
    out(`released ${values.release}`);
  }
  const b = await s.budget();
  out(`Session  ${values.session ?? "default"} (${net})`);
  out(`Cap      ${b.cap} USDC (max ${b.perCall} per call)`);
  out(`Spent    ${b.spent} USDC`);
  out(`Pending  ${b.pending} USDC`);
  out(`Left     ${b.remaining} USDC`);
  for (const hold of await s.holds()) {
    out(`  hold ${hold.id}  ${hold.amount} USDC  ${hold.state}` + (hold.transaction ? `  ${explorerTxUrl(hold.transaction, net)}` : "  (no transaction)"));
  }
}

async function main() {
  const [command, a, b, c] = positionals;
  if (values.help || !command) return out(HELP);
  switch (command) {
    case "wallet":
      return walletCommand(a);
    case "tools":
      return toolsCommand(a);
    case "call":
      return callCommand(a, b, c);
    case "budget":
      return budgetCommand();
    case "router": {
      const secretKey = await resolveSecret(values.secret);
      return runRouter({ secretKey, network: network(), rpcUrl: values["rpc-url"] ?? process.env.STELLAR_RPC_URL,
        store: await agentStore(secretKey),
        ...limits(), gatewayUrl: values.gateway ?? (network() === DEFAULT_NETWORK ? "https://stellarpay-gateway-ten.vercel.app" : undefined),
        // Rail402's hosted testnet Bazaar is free and keyless; pass --bazaar "" to turn it off.
        manifestPath: values.manifest, bazaarUrl: (values.bazaar ?? (network() === DEFAULT_NETWORK ? "https://testnet.rail402.dev" : undefined)) || undefined,
        allowLoopback: values["allow-local"],
      });
    }
    case "connect": {
      const urls = (values.urls ?? process.env.STELLARPAY_URLS ?? a ?? "").split(",").map((u) => u.trim()).filter(Boolean);
      if (!urls.length) throw new Error("Usage: stellarpay connect --urls <url1,url2>");
      const secretKey = await resolveSecret(values.secret);
      return runBridge({
        urls,
        secretKey,
        store: await agentStore(secretKey),
        verifyReceipts: true,
        network: network(),
        rpcUrl: values["rpc-url"] ?? process.env.STELLAR_RPC_URL,
        ...limits(),
      });
    }
    default:
      out(HELP);
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`error: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}).finally(() => store?.close());
