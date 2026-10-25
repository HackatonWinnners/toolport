import { randomUUID } from "node:crypto";
import { StrKey } from "@stellar/stellar-sdk";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  explorerTxUrl,
  fromUnits,
  getAccountStatus,
  toUnits,
  type StellarNetwork,
} from "@stellarpay/core";
import type { WalletAuth } from "./auth.js";
import type { Db } from "./db/index.js";
import { calls, servers, tools, type ServerRow, type ToolRow } from "./db/schema.js";
import type { PaymentEngine } from "./payments.js";
import { proxyMcp } from "./proxy.js";
import { assertPublicUpstream, inspectUpstream, type UpstreamTool } from "./upstream.js";

export interface AppDeps {
  db: Db;
  engine: PaymentEngine;
  auth: WalletAuth;
  network: StellarNetwork;
  publicUrl: string;
  webOrigins?: string[];
  /** Allow upstreams on loopback/private networks (local development and tests) */
  allowPrivateUpstreams?: boolean;
  /** Override for tests (no network calls) */
  inspect?: typeof inspectUpstream;
  accountStatus?: typeof getAccountStatus;
}

const priceSchema = z.union([z.string(), z.number()]).transform((v, ctx) => {
  try {
    return toUnits(v).toString();
  } catch (error) {
    ctx.addIssue({ code: "custom", message: (error as Error).message });
    return z.NEVER;
  }
});

const stellarAddress = z
  .string()
  .refine((a) => StrKey.isValidEd25519PublicKey(a) || StrKey.isValidContract(a), "Not a Stellar G... or C... address");

const createServerBody = z.object({
  upstreamUrl: z.string().url(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  payTo: stellarAddress.optional(),
  listed: z.boolean().optional(),
  /** Optional initial prices: { toolName: "$0.01" } */
  prices: z.record(priceSchema).optional(),
});

const updateServerBody = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  payTo: stellarAddress.optional(),
  listed: z.boolean().optional(),
});

const updateToolBody = z.object({
  price: priceSchema.optional(),
  enabled: z.boolean().optional(),
});

function newServerId() {
  return `srv_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function createApp(deps: AppDeps) {
  const { db, engine, auth } = deps;
  const inspect = deps.inspect ?? inspectUpstream;
  const accountStatus = deps.accountStatus ?? getAccountStatus;
  const app = new Hono();
  const checkUpstream = async (url: string) => {
    if (deps.allowPrivateUpstreams) return;
    try {
      await assertPublicUpstream(url);
    } catch (error) {
      throw new HttpError(422, `Upstream not allowed: ${(error as Error).message}`);
    }
  };

  app.use(
    "/api/*",
    cors({ origin: deps.webOrigins ?? "*", allowHeaders: ["Authorization", "Content-Type"], credentials: false }),
  );
  // MCP clients (browsers included) talk to the proxy directly.
  app.use(
    "/v1/*",
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Accept", "Mcp-Session-Id", "Mcp-Protocol-Version", "Last-Event-Id"],
      exposeHeaders: ["Mcp-Session-Id"],
    }),
  );

  const requireOwner = (c: Context) => {
    const address = auth.read(c.req.header("authorization"));
    if (!address) throw new HttpError(401, "Sign in with your Stellar wallet first");
    return address;
  };

  const loadServer = async (id: string) => {
    const [server] = await db.select().from(servers).where(eq(servers.id, id));
    if (!server) throw new HttpError(404, "Server not found");
    return server;
  };

  const loadOwnedServer = async (c: Context) => {
    const owner = requireOwner(c);
    const server = await loadServer(c.req.param("id")!);
    if (server.owner !== owner) throw new HttpError(403, "Not your server");
    return server;
  };

  // The upstream URL is the owner's secret: anyone holding it could call the tools without paying.
  const present = async (server: ServerRow, viewer: string | null = null) => ({
    id: server.id,
    name: server.name,
    description: server.description,
    owner: server.owner,
    payTo: server.payTo,
    network: server.network,
    listed: server.listed,
    upstreamUrl: viewer === server.owner ? server.upstreamUrl : undefined,
    mcpUrl: `${deps.publicUrl}/v1/mcp/${server.id}`,
    createdAt: server.createdAt,
    tools: (await db.select().from(tools).where(eq(tools.serverId, server.id))).map(presentTool),
  });

  // ---- health ------------------------------------------------------------
  app.get("/api/health", async (c) => {
    let facilitator: "ok" | string = "ok";
    try {
      await engine.resourceServer();
    } catch (error) {
      facilitator = (error as Error).message;
    }
    let database: "ok" | string = "ok";
    try {
      await db.select({ id: servers.id }).from(servers).limit(1);
    } catch (error) {
      database = ((error as Error).cause as Error | undefined)?.message ?? (error as Error).message;
    }
    return c.json({ ok: facilitator === "ok" && database === "ok", network: deps.network, facilitator, database });
  });

  // ---- auth --------------------------------------------------------------
  app.post("/api/auth/challenge", async (c) => {
    const { address } = z.object({ address: z.string() }).parse(await c.req.json());
    try {
      return c.json(auth.challenge(address));
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }
  });

  app.post("/api/auth/verify", async (c) => {
    const { address, signature, message } = z
      .object({ address: z.string(), signature: z.string(), message: z.string().optional() })
      .parse(await c.req.json());
    try {
      return c.json({ token: auth.verify(address, signature, message), address });
    } catch (error) {
      throw new HttpError(401, (error as Error).message);
    }
  });

  app.get("/api/me", (c) => c.json({ address: requireOwner(c) }));

  // ---- accounts ----------------------------------------------------------
  app.get("/api/accounts/:address", async (c) => {
    const address = stellarAddress.parse(c.req.param("address"));
    return c.json(await accountStatus(address, deps.network));
  });

  // ---- servers -----------------------------------------------------------
  app.get("/api/servers", async (c) => {
    const mine = c.req.query("mine") === "true";
    const viewer = mine ? requireOwner(c) : auth.read(c.req.header("authorization"));
    const rows = mine
      ? await db.select().from(servers).where(eq(servers.owner, viewer!)).orderBy(desc(servers.createdAt))
      : await db.select().from(servers).where(eq(servers.listed, true)).orderBy(desc(servers.createdAt));
    return c.json({ servers: await Promise.all(rows.map((s) => present(s, viewer))) });
  });

  app.post("/api/servers", async (c) => {
    const owner = requireOwner(c);
    const body = createServerBody.parse(await c.req.json());
    await checkUpstream(body.upstreamUrl);
    let upstream: Awaited<ReturnType<typeof inspectUpstream>>;
    try {
      upstream = await inspect(body.upstreamUrl);
    } catch (error) {
      throw new HttpError(422, `Could not reach MCP server at ${body.upstreamUrl}: ${(error as Error).message}`);
    }
    const id = newServerId();
    const [server] = await db
      .insert(servers)
      .values({
        id,
        owner,
        name: body.name ?? upstream.name ?? new URL(body.upstreamUrl).hostname,
        description: body.description ?? "",
        upstreamUrl: body.upstreamUrl,
        payTo: body.payTo ?? owner,
        network: deps.network,
        listed: body.listed ?? true,
      })
      .returning();
    await syncTools(db, id, upstream.tools, body.prices);
    return c.json(await present(server, owner), 201);
  });

  app.get("/api/servers/:id", async (c) =>
    c.json(await present(await loadServer(c.req.param("id")), auth.read(c.req.header("authorization")))),
  );

  app.patch("/api/servers/:id", async (c) => {
    const server = await loadOwnedServer(c);
    const body = updateServerBody.parse(await c.req.json());
    const [updated] = await db.update(servers).set(body).where(eq(servers.id, server.id)).returning();
    return c.json(await present(updated, updated.owner));
  });

  app.delete("/api/servers/:id", async (c) => {
    const server = await loadOwnedServer(c);
    await db.delete(calls).where(eq(calls.serverId, server.id));
    await db.delete(tools).where(eq(tools.serverId, server.id));
    await db.delete(servers).where(eq(servers.id, server.id));
    return c.json({ deleted: server.id });
  });

  app.post("/api/servers/:id/refresh", async (c) => {
    const server = await loadOwnedServer(c);
    await checkUpstream(server.upstreamUrl);
    const upstream = await inspect(server.upstreamUrl);
    await syncTools(db, server.id, upstream.tools);
    return c.json(await present(server, server.owner));
  });

  app.patch("/api/servers/:id/tools/:name", async (c) => {
    const server = await loadOwnedServer(c);
    const body = updateToolBody.parse(await c.req.json());
    const patch: Partial<ToolRow> = {};
    if (body.price !== undefined) patch.priceUnits = body.price;
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    const [tool] = await db
      .update(tools)
      .set(patch)
      .where(and(eq(tools.serverId, server.id), eq(tools.name, c.req.param("name"))))
      .returning();
    if (!tool) throw new HttpError(404, "Tool not found");
    return c.json(presentTool(tool));
  });

  // ---- analytics ---------------------------------------------------------
  app.get("/api/servers/:id/calls", async (c) => {
    const server = await loadOwnedServer(c);
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const rows = await db
      .select()
      .from(calls)
      .where(eq(calls.serverId, server.id))
      .orderBy(desc(calls.createdAt))
      .limit(limit);
    return c.json({
      calls: rows.map((r) => ({
        ...r,
        amountUsd: fromUnits(r.amountUnits),
        explorerUrl: r.txHash ? explorerTxUrl(r.txHash, server.network) : null,
      })),
    });
  });

  app.get("/api/servers/:id/stats", async (c) => {
    const server = await loadOwnedServer(c);
    const byTool = await db
      .select({
        tool: calls.tool,
        calls: sql<number>`count(*)`,
        paidCalls: sql<number>`sum(case when ${calls.status} = 'paid' then 1 else 0 end)`,
        failedCalls: sql<number>`sum(case when ${calls.status} in ('verify_failed','tool_failed','settle_failed') then 1 else 0 end)`,
        // amounts are 7-decimal integers stored as text; sum as integers
        revenueUnits: sql<number>`sum(case when ${calls.status} = 'paid' then cast(${calls.amountUnits} as integer) else 0 end)`,
        avgLatencyMs: sql<number>`avg(${calls.latencyMs})`,
      })
      .from(calls)
      .where(eq(calls.serverId, server.id))
      .groupBy(calls.tool);
    const [{ payers }] = await db
      .select({ payers: sql<number>`count(distinct ${calls.payer})` })
      .from(calls)
      .where(and(eq(calls.serverId, server.id), eq(calls.status, "paid")));
    const revenueUnits = byTool.reduce((sum, t) => sum + BigInt(t.revenueUnits ?? 0), 0n);
    return c.json({
      calls: byTool.reduce((n, t) => n + Number(t.calls), 0),
      paidCalls: byTool.reduce((n, t) => n + Number(t.paidCalls ?? 0), 0),
      payers: Number(payers ?? 0),
      revenueUnits: revenueUnits.toString(),
      revenueUsd: fromUnits(revenueUnits),
      byTool: byTool.map((t) => ({
        ...t,
        revenueUnits: String(t.revenueUnits ?? 0),
        revenueUsd: fromUnits(BigInt(t.revenueUnits ?? 0)),
        avgLatencyMs: Math.round(Number(t.avgLatencyMs ?? 0)),
      })),
    });
  });

  // ---- the paid MCP proxy ----------------------------------------------------
  app.all("/v1/mcp/:id", async (c) => {
    const server = await loadServer(c.req.param("id"));
    // Re-checked per request: the upstream's DNS may have changed since registration.
    await checkUpstream(server.upstreamUrl);
    return proxyMcp({ db, engine, server, request: c.req.raw, log: (m) => console.log(m) });
  });

  app.get("/", (c) =>
    c.json({
      name: "StellarPay MCP gateway",
      network: deps.network,
      docs: "https://github.com/ (see README)",
      endpoints: ["/v1/mcp/:serverId", "/api/servers", "/api/health"],
    }),
  );

  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: error.message }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: "Invalid request", issues: error.issues }, 400);
    console.error(error);
    return c.json({ error: error.message }, 500);
  });

  return app;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function presentTool(tool: ToolRow) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    priceUnits: tool.priceUnits,
    priceUsd: fromUnits(tool.priceUnits),
    paid: BigInt(tool.priceUnits) > 0n,
    enabled: tool.enabled,
  };
}

/** Upsert tools from the upstream; keep owner-set prices, drop tools the upstream no longer has. */
async function syncTools(db: Db, serverId: string, upstreamTools: UpstreamTool[], prices: Record<string, string> = {}) {
  const existing = new Map(
    (await db.select().from(tools).where(eq(tools.serverId, serverId))).map((t) => [t.name, t]),
  );
  for (const tool of upstreamTools) {
    const current = existing.get(tool.name);
    // Tools that already charge via x402 themselves (advertisedUnits) stay free at the gateway:
    // their payment metadata passes through untouched, so callers are never charged twice.
    const priceUnits = tool.advertisedUnits ? "0" : (prices[tool.name] ?? current?.priceUnits ?? "0");
    if (current) {
      await db
        .update(tools)
        .set({ description: tool.description, inputSchema: tool.inputSchema, priceUnits })
        .where(and(eq(tools.serverId, serverId), eq(tools.name, tool.name)));
      existing.delete(tool.name);
    } else {
      await db.insert(tools).values({
        serverId,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        priceUnits,
      });
    }
  }
  for (const name of existing.keys()) {
    await db.delete(tools).where(and(eq(tools.serverId, serverId), eq(tools.name, name)));
  }
}
