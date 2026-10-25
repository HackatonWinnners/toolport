import { serve, type ServerType } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Keypair } from "@stellar/stellar-sdk";
import type { FacilitatorClient } from "@x402/core/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { NETWORKS, PRICE_META_KEY } from "@stellarpay/core";
import { createPaidMcpHandler } from "../src/server.js";
import { PaymentRefusedError, SpendGuard, StellarPayClient } from "../src/client.js";

const payTo = Keypair.random().publicKey();
const facilitator: FacilitatorClient = {
  verify: vi.fn(async () => ({ isValid: true, payer: "GPAYER" })),
  settle: vi.fn(async () => ({ success: true, transaction: "tx123", network: "stellar:testnet", payer: "GPAYER" })),
  getSupported: async () => ({
    kinds: [{ x402Version: 2, scheme: "exact", network: "stellar:testnet", extra: { areFeesSponsored: true } }],
    extensions: [],
    signers: {},
  }),
} as FacilitatorClient;

let server: ServerType;
let url: string;

beforeAll(async () => {
  const handler = createPaidMcpHandler(
    (s) => {
      s.tool("ping", "Health check", {}, async () => ({ content: [{ type: "text", text: "pong" }] }));
      s.paidTool("echo", "Echo back the input", "$0.02", { text: z.string() }, async ({ text }) => ({
        content: [{ type: "text", text }],
      }));
    },
    { payTo, facilitator },
  );
  await new Promise<void>((resolve) => {
    server = serve({ fetch: handler, port: 0 }, (info) => {
      url = `http://127.0.0.1:${info.port}/mcp`;
      resolve();
    });
  });
});

afterAll(() => server?.close());

async function rawClient() {
  const client = new Client({ name: "test", version: "0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

describe("paid MCP server", () => {
  it("advertises prices in tools/list", async () => {
    const client = await rawClient();
    const { tools } = await client.listTools();
    const echo = tools.find((t) => t.name === "echo")!;
    expect(echo.description).toContain("$0.02 USDC");
    expect(echo._meta?.[PRICE_META_KEY]).toMatchObject({ amount: "200000", network: "stellar:testnet" });
    await client.close();
  });

  it("answers an unpaid call with x402 PaymentRequired in USDC base units", async () => {
    const client = await rawClient();
    const result = (await client.callTool({ name: "echo", arguments: { text: "hi" } })) as any;
    expect(result.isError).toBe(true);
    const accepts = result.structuredContent.accepts[0];
    expect(accepts).toMatchObject({
      scheme: "exact",
      network: "stellar:testnet",
      amount: "200000",
      asset: NETWORKS["stellar:testnet"].usdcContract,
      payTo,
    });
    expect(JSON.parse(result.content[0].text).accepts[0].amount).toBe("200000");
    await client.close();
  });

  it("leaves free tools free", async () => {
    const client = await rawClient();
    const result = (await client.callTool({ name: "ping", arguments: {} })) as any;
    expect(result.content[0].text).toBe("pong");
    await client.close();
  });
});

describe("StellarPayClient spend limits", () => {
  it("refuses a call above the per-call cap without signing anything", async () => {
    const client = new StellarPayClient({ secretKey: Keypair.random().secret(), maxPerCall: "$0.01" });
    await client.connect(url);
    await expect(client.callTool("echo", { text: "hi" })).rejects.toThrow(PaymentRefusedError);
    await expect(client.callTool("echo", { text: "hi" })).rejects.toThrow(/exceeds per-call cap \$0.01/);
    expect(facilitator.verify).not.toHaveBeenCalled();
    expect(client.guard.spent).toBe(0n);
    await client.close();
  });

  it("tracks the session budget", () => {
    const guard = new SpendGuard({ budget: "$0.05" });
    expect(guard.check(200_000n)).toBeNull();
    guard.record(200_000n);
    guard.record(200_000n);
    expect(guard.check(200_000n)).toMatch(/session budget/);
    expect(guard.remaining()).toBe(100_000n);
  });

  it("holds budget for in-flight calls so concurrent calls can't overshoot it", () => {
    const guard = new SpendGuard({ budget: "$0.03" });
    expect(guard.reserve(200_000n)).toBeNull();
    expect(guard.reserve(200_000n)).toMatch(/in flight/);
    guard.release(200_000n, false); // first call failed: nothing spent, budget free again
    expect(guard.spent).toBe(0n);
    expect(guard.reserve(200_000n)).toBeNull();
    guard.release(200_000n, true);
    expect(guard.spent).toBe(200_000n);
    expect(guard.reserved).toBe(0n);
  });
});
