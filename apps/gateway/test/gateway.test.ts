import { createHash } from "node:crypto";
import { serve, type ServerType } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Keypair } from "@stellar/stellar-sdk";
import type { FacilitatorClient } from "@x402/core/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { NETWORKS, PAYMENT_META_KEY, PAYMENT_RESPONSE_META_KEY, PRICE_META_KEY } from "@stellarpay/core";
import { createApp } from "../src/app.js";
import { assertPublicUpstream } from "../src/upstream.js";
import { WalletAuth } from "../src/auth.js";
import { createDb, migrate } from "../src/db/index.js";
import { PaymentEngine } from "../src/payments.js";

const owner = Keypair.random().publicKey();
const seenMeta: unknown[] = [];
/** Flip on to simulate the upstream shipping a new tool after registration */
let lateTool = false;

const facilitator = {
  verify: vi.fn(async () => ({ isValid: true, payer: "GAGENT" })),
  settle: vi.fn(async () => ({ success: true, transaction: "abc123", network: "stellar:testnet", payer: "GAGENT" })),
  getSupported: async () => ({
    kinds: [{ x402Version: 2, scheme: "exact", network: "stellar:testnet", extra: { areFeesSponsored: true } }],
    extensions: [],
    signers: {},
  }),
} as unknown as FacilitatorClient & { verify: ReturnType<typeof vi.fn>; settle: ReturnType<typeof vi.fn> };

function upstreamHandler(json: boolean) {
  return async (request: Request) => {
    const server = new McpServer({ name: "upstream-demo", version: "1.0.0" });
    server.registerTool("echo", { description: "Echo text", inputSchema: { text: z.string() } }, async ({ text }, extra) => {
      seenMeta.push(extra._meta);
      return { content: [{ type: "text", text }] };
    });
    server.registerTool("fail", { description: "Always fails", inputSchema: {} }, async () => ({
      isError: true,
      content: [{ type: "text", text: "boom" }],
    }));
    server.registerTool("ping", { description: "Free", inputSchema: {} }, async () => ({
      content: [{ type: "text", text: "pong" }],
    }));
    if (lateTool) {
      server.registerTool("late", { description: "Added later", inputSchema: {} }, async () => ({
        content: [{ type: "text", text: "late" }],
      }));
    }
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: json });
    await server.connect(transport);
    return transport.handleRequest(request);
  };
}

function listen(fetch: (r: Request) => Promise<Response> | Response): Promise<{ server: ServerType; url: string }> {
  return new Promise((resolve) => {
    const server = serve({ fetch, port: 0 }, (info) => resolve({ server, url: `http://127.0.0.1:${info.port}` }));
  });
}

const servers: ServerType[] = [];
let gatewayUrl: string;
let mcpUrl: string;
const headers = { authorization: `Bearer ${owner}`, "content-type": "application/json" };

beforeAll(async () => {
  // SSE upstream: exercises the gateway's event-stream parsing
  const upstream = await listen(upstreamHandler(false));
  servers.push(upstream.server);
  const db = await createDb(":memory:");
  await migrate(db);
  const engine = new PaymentEngine({ db, facilitator, network: "stellar:testnet", publicUrl: "http://gw.test" });
  const gateway = await listen(
    createApp({
      db,
      engine,
      auth: new WalletAuth("test", true),
      network: "stellar:testnet",
      publicUrl: "http://gw.test",
      allowPrivateUpstreams: true,
    }).fetch,
  );
  servers.push(gateway.server);
  gatewayUrl = gateway.url;

  const res = await fetch(`${gatewayUrl}/api/servers`, {
    method: "POST",
    headers,
    body: JSON.stringify({ upstreamUrl: `${upstream.url}/mcp`, prices: { echo: "$0.02", fail: "$0.01" } }),
  });
  expect(res.status).toBe(201);
  const created = await res.json();
  expect(created.name).toBe("upstream-demo");
  expect(created.tools.map((t: any) => [t.name, t.priceUsd]).sort()).toEqual([
    ["echo", "0.02"],
    ["fail", "0.01"],
    ["ping", "0"],
  ]);
  mcpUrl = `${gatewayUrl}/v1/mcp/${created.id}`;
});

afterAll(() => servers.forEach((s) => s.close()));

async function mcp() {
  const client = new Client({ name: "agent", version: "0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
  return client;
}

async function quote(client: Client, name: string, args: Record<string, unknown>) {
  const result = (await client.callTool({ name, arguments: args })) as any;
  expect(result.isError).toBe(true);
  return result.structuredContent;
}

const fakePayment = (accepted: unknown, tx: string) => ({
  x402Version: 2,
  accepted,
  payload: { transaction: tx },
});

describe("gateway proxy", () => {
  it("shows prices in tools/list", async () => {
    const client = await mcp();
    const { tools } = await client.listTools();
    const echo = tools.find((t) => t.name === "echo")!;
    expect(echo.description).toContain("$0.02 USDC");
    expect(echo._meta?.[PRICE_META_KEY]).toMatchObject({ amount: "200000" });
    expect(tools.find((t) => t.name === "ping")!.description).toBe("Free");
    await client.close();
  });

  it("quotes unpaid calls in USDC to the owner's address", async () => {
    const client = await mcp();
    const required = await quote(client, "echo", { text: "hi" });
    expect(required.accepts[0]).toMatchObject({
      amount: "200000",
      payTo: owner,
      asset: NETWORKS["stellar:testnet"].usdcContract,
      network: "stellar:testnet",
    });
    expect(facilitator.verify).not.toHaveBeenCalled();
    await client.close();
  });

  it("verifies, forwards without the payment, settles and attaches the receipt", async () => {
    const client = await mcp();
    const required = await quote(client, "echo", { text: "hi" });
    const result = (await client.callTool({
      name: "echo",
      arguments: { text: "paid hello" },
      _meta: { [PAYMENT_META_KEY]: fakePayment(required.accepts[0], "tx-1") },
    })) as any;
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe("paid hello");
    expect(result._meta[PAYMENT_RESPONSE_META_KEY]).toMatchObject({ success: true, transaction: "abc123" });
    expect(facilitator.settle).toHaveBeenCalledTimes(1);
    const meta = seenMeta.at(-1) as Record<string, unknown> | undefined;
    expect(meta?.[PAYMENT_META_KEY]).toBeUndefined();
    await client.close();
  });

  it("refuses a replayed payment payload", async () => {
    const client = await mcp();
    const required = await quote(client, "echo", { text: "hi" });
    const result = (await client.callTool({
      name: "echo",
      arguments: { text: "again" },
      _meta: { [PAYMENT_META_KEY]: fakePayment(required.accepts[0], "tx-1") },
    })) as any;
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatch(/already used/);
    await client.close();
  });

  it("does not settle when the tool fails", async () => {
    const client = await mcp();
    const settledBefore = facilitator.settle.mock.calls.length;
    const required = await quote(client, "fail", {});
    const result = (await client.callTool({
      name: "fail",
      arguments: {},
      _meta: { [PAYMENT_META_KEY]: fakePayment(required.accepts[0], "tx-2") },
    })) as any;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("boom");
    expect(facilitator.settle.mock.calls.length).toBe(settledBefore);
    await client.close();
  });

  it("rejects a payment for the wrong amount", async () => {
    const client = await mcp();
    const required = await quote(client, "echo", { text: "hi" });
    const cheap = { ...required.accepts[0], amount: "1" };
    const result = (await client.callTool({
      name: "echo",
      arguments: { text: "cheap" },
      _meta: { [PAYMENT_META_KEY]: fakePayment(cheap, "tx-3") },
    })) as any;
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatch(/does not match/);
    await client.close();
  });

  it("passes free tools straight through", async () => {
    const client = await mcp();
    const result = (await client.callTool({ name: "ping", arguments: {} })) as any;
    expect(result.content[0].text).toBe("pong");
    await client.close();
  });

  it("hides the upstream URL from everyone but the owner", async () => {
    const detail = mcpUrl.replace("/v1/mcp/", "/api/servers/");
    expect((await (await fetch(detail)).json()).upstreamUrl).toBeUndefined();
    expect((await (await fetch(`${gatewayUrl}/api/servers`)).json()).servers[0].upstreamUrl).toBeUndefined();
    expect((await (await fetch(detail, { headers })).json()).upstreamUrl).toMatch(/^http/);
  });

  it("reports calls and revenue to the owner", async () => {
    const stats = await (await fetch(`${mcpUrl.replace("/v1/mcp/", "/api/servers/")}/stats`, { headers })).json();
    expect(stats.revenueUsd).toBe("0.02");
    expect(stats.paidCalls).toBe(1);
    const statuses = (
      await (await fetch(`${mcpUrl.replace("/v1/mcp/", "/api/servers/")}/calls`, { headers })).json()
    ).calls.map((c: any) => c.status);
    expect(statuses).toEqual(expect.arrayContaining(["paid", "tool_failed", "free"]));
    const other = await fetch(`${mcpUrl.replace("/v1/mcp/", "/api/servers/")}/stats`, {
      headers: { authorization: `Bearer ${Keypair.random().publicKey()}` },
    });
    expect(other.status).toBe(403);
  });

  it("refuses batched tool calls", async () => {
    const res = await fetch(mcpUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ping", arguments: {} } }]),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/cannot be batched/);
  });

  it("keeps tools the upstream added after registration closed until the owner refreshes", async () => {
    lateTool = true;
    try {
      const client = await mcp();
      expect((await client.listTools()).tools.map((t) => t.name)).not.toContain("late");
      await expect(client.callTool({ name: "late", arguments: {} })).rejects.toThrow(/Unknown tool late/);
      const refresh = await fetch(`${mcpUrl.replace("/v1/mcp/", "/api/servers/")}/refresh`, { method: "POST", headers });
      expect(refresh.status).toBe(200);
      expect((await client.listTools()).tools.map((t) => t.name)).toContain("late");
      await client.close();
    } finally {
      lateTool = false;
    }
  });
});

describe("upstream SSRF guard", () => {
  it.each([
    "http://127.0.0.1:4022/mcp",
    "http://localhost/mcp",
    "http://169.254.169.254/latest/meta-data",
    "http://10.1.2.3/mcp",
    "http://[::1]/mcp",
    "http://[::ffff:127.0.0.1]/mcp",
    "file:///etc/passwd",
  ])("refuses %s", async (url) => {
    await expect(assertPublicUpstream(url)).rejects.toThrow();
  });

  it("allows public addresses", async () => {
    await expect(assertPublicUpstream("https://1.1.1.1/mcp")).resolves.toBeUndefined();
  });

  it("refuses to register a private upstream on a hosted gateway", async () => {
    const db = await createDb(":memory:");
    await migrate(db);
    const engine = new PaymentEngine({ db, facilitator, network: "stellar:testnet", publicUrl: "http://gw.test" });
    const app = createApp({ db, engine, auth: new WalletAuth("test", true), network: "stellar:testnet", publicUrl: "http://gw.test" });
    const res = await app.request("/api/servers", {
      method: "POST",
      headers,
      body: JSON.stringify({ upstreamUrl: "http://127.0.0.1:4022/mcp" }),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/private or loopback/);
  });
});

describe("wallet sign-in", () => {
  const auth = new WalletAuth("secret-for-tests");
  const keypair = Keypair.random();
  const sign = (message: string, kp = keypair) =>
    kp.sign(createHash("sha256").update(`Stellar Signed Message:\n${message}`).digest()).toString("base64");

  it("issues a session for a SEP-53 signature over a fresh challenge, on any instance", () => {
    const { message } = auth.challenge(keypair.publicKey());
    // A different WalletAuth with the same secret (another serverless instance) accepts it.
    const token = new WalletAuth("secret-for-tests").verify(keypair.publicKey(), sign(message), message);
    expect(auth.read(`Bearer ${token}`)).toBe(keypair.publicKey());
  });

  it("refuses a challenge for another address, a tampered expiry, or the wrong signer", () => {
    const { message } = auth.challenge(keypair.publicKey());
    const other = Keypair.random();
    expect(() => auth.verify(other.publicKey(), sign(message, other), message)).toThrow(/Bad challenge/);
    const later = message.replace(/Expires: \S+/, `Expires: ${new Date(Date.now() + 86_400_000).toISOString()}`);
    expect(() => auth.verify(keypair.publicKey(), sign(later), later)).toThrow(/Bad challenge/);
    expect(() => auth.verify(keypair.publicKey(), sign(message, other), message)).toThrow(/Bad signature/);
  });

  it("refuses a session token minted with another secret", () => {
    const forged = new WalletAuth("guessed-secret").issue(keypair.publicKey());
    expect(auth.read(`Bearer ${forged}`)).toBeNull();
  });
});

describe("durable serverless payment claims", () => {
  it("shares replay protection between separate engine instances and canonicalizes payload keys", async () => {
    const db = await createDb(":memory:");
    await migrate(db);
    const a = new PaymentEngine({ db, facilitator, network: "stellar:testnet", publicUrl: "http://test" });
    const b = new PaymentEngine({ db, facilitator, network: "stellar:testnet", publicUrl: "http://test" });
    const proof = { x402Version: 2, payload: { transaction: "same-proof", extra: 1 } } as any;
    expect(await a.claim(proof)).toBe(true);
    expect(await b.claim({ ...proof, payload: { extra: 1, transaction: "same-proof" } })).toBe(false);
  });
  it("does not advertise a fresh payment challenge when settlement times out", async () => {
    const client = await mcp();
    try {
      const required = await quote(client, "echo", { text: "uncertain" });
      facilitator.settle.mockRejectedValueOnce(new Error("timeout after submit"));
      const result = await client.callTool({ name: "echo", arguments: { text: "uncertain" }, _meta: { [PAYMENT_META_KEY]: fakePayment(required.accepts[0], "uncertain-proof") } }) as any;
      expect(result.isError).toBe(true);
      expect(result._meta?.["stellarpay/payment-state"]).toBe("unknown");
      expect(result.structuredContent?.accepts).toBeUndefined();
    } finally { await client.close(); }
  });
});
