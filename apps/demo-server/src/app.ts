import { Hono } from "hono";
import { z } from "zod";
import {
  DEFAULT_NETWORK,
  facilitatorSettingsFromEnv,
  isStellarNetworkId,
  type StellarNetwork,
} from "@stellarpay/core";
import { createMcpHandler, createPaidMcpHandler } from "@stellarpay/mcp/server";
import { StellarOracle } from "./oracle.js";

const network = (process.env.STELLAR_NETWORK ?? DEFAULT_NETWORK) as StellarNetwork;
if (!isStellarNetworkId(network)) throw new Error(`Unsupported STELLAR_NETWORK ${network}`);
const oracle = new StellarOracle(network);
const info = { name: "stellar-oracle", version: "0.1.0" };

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const failure = (error: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
});
const guard =
  <A,>(fn: (args: A) => Promise<unknown>) =>
  async (args: A) => {
    try {
      return text(await fn(args));
    } catch (error) {
      return failure(error);
    }
  };

const accountShape = { address: z.string().describe("Stellar account (G...)") };
const pathShape = {
  from: z.string().describe('Asset to send: "XLM", "USDC" or "CODE:ISSUER"'),
  to: z.string().describe('Asset to receive: "XLM", "USDC" or "CODE:ISSUER"'),
  amount: z.string().describe("Amount of the source asset, e.g. \"100\""),
};
const descriptions = {
  ping: "Health check",
  account: "Balances and the 5 most recent operations of a Stellar account",
  path: "Best path to swap one Stellar asset into another across the DEX and AMMs, with the expected amount out",
};
const prices = {
  account: process.env.PRICE_ACCOUNT_SUMMARY ?? "$0.01",
  path: process.env.PRICE_DEX_BEST_PATH ?? "$0.02",
};

/**
 * Two ways to run it:
 *  - PAY_TO set: the server charges by itself with @stellarpay/mcp (flow B, no gateway)
 *  - PAY_TO unset: a free upstream, priced by the StellarPay gateway (flow A)
 */
const payTo = process.env.PAY_TO;
const handler = payTo
  ? createPaidMcpHandler(
      (server) => {
        server.tool("ping", descriptions.ping, {}, async () => text("pong"));
        server.paidTool("account_summary", descriptions.account, prices.account, accountShape, guard(({ address }) => oracle.accountSummary(address)));
        server.paidTool("dex_best_path", descriptions.path, prices.path, pathShape, guard(({ from, to, amount }) => oracle.bestPath(from, to, amount)));
      },
      {
        payTo,
        network,
        facilitator: facilitatorSettingsFromEnv(),
        serverInfo: info,
        onPayment: ({ tool, settlement }) => console.log(`paid: ${tool} tx=${settlement.transaction}`),
      },
    )
  : createMcpHandler((server) => {
      server.tool("ping", descriptions.ping, {}, async () => text("pong"));
      server.tool("account_summary", descriptions.account, accountShape, guard(({ address }) => oracle.accountSummary(address)));
      server.tool("dex_best_path", descriptions.path, pathShape, guard(({ from, to, amount }) => oracle.bestPath(from, to, amount)));
    }, info);

export const app = new Hono();
app.all("/mcp", (c) => handler(c.req.raw));
app.get("/", (c) => c.json({ name: info.name, mcp: "/mcp", mode: payTo ? "self-charging" : "free upstream", network }));

export const description = `Stellar Oracle MCP (${payTo ? `charging to ${payTo}` : "free upstream"})`;
