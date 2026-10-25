import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  PAYMENT_META_KEY,
  PAYMENT_RESPONSE_META_KEY,
  PRICE_META_KEY,
  formatUsd,
  paymentRequiredToolResult,
  readPaymentFromMeta,
} from "@stellarpay/core";
import type { Db } from "./db/index.js";
import { calls, tools, type CallStatus, type ServerRow, type ToolRow } from "./db/schema.js";
import { findResponse, isRequest, rpcError, rpcResult, type JsonRpcRequest, type JsonRpcResponse } from "./jsonrpc.js";
import type { PaymentEngine } from "./payments.js";

const FORWARD_REQUEST_HEADERS = ["accept", "content-type", "mcp-session-id", "mcp-protocol-version", "last-event-id"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "mcp-session-id", "cache-control"];

export interface ProxyContext {
  db: Db;
  engine: PaymentEngine;
  server: ServerRow;
  request: Request;
  log?: (message: string) => void;
}

/** Streamable-HTTP MCP reverse proxy that charges for priced tools/call requests. */
export async function proxyMcp(ctx: ProxyContext): Promise<Response> {
  const { request } = ctx;
  if (request.method !== "POST") return passthrough(ctx, undefined);

  const raw = await request.text();
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return passthrough(ctx, raw);
  }

  if (Array.isArray(message)) {
    // Batches can't carry a per-call payment handshake (and MCP dropped batching), so tool calls
    // must come one per request; otherwise pricing and the enabled flag could be skipped.
    const call = message.find((m) => isRequest(m) && m.method === "tools/call") as JsonRpcRequest | undefined;
    if (call) return json(rpcError(call.id ?? null, -32600, "Tool calls cannot be batched"), 400);
    return passthrough(ctx, raw);
  }
  if (!isRequest(message)) return passthrough(ctx, raw);
  if (message.method === "tools/list") return listTools(ctx, message, raw);
  if (message.method === "tools/call") return callTool(ctx, message, raw);
  return passthrough(ctx, raw);
}

async function forward(ctx: ProxyContext, body: string | undefined): Promise<Response> {
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = ctx.request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("accept")) headers.set("accept", "application/json, text/event-stream");
  return fetch(ctx.server.upstreamUrl, {
    method: ctx.request.method,
    headers,
    body: ctx.request.method === "GET" || ctx.request.method === "HEAD" ? undefined : body,
  });
}

function responseHeaders(upstream: Response, overrides: Record<string, string> = {}) {
  const headers = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  for (const [k, v] of Object.entries(overrides)) headers.set(k, v);
  return headers;
}

async function passthrough(ctx: ProxyContext, body: string | undefined): Promise<Response> {
  const upstream = await forward(ctx, body);
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders(upstream) });
}

function json(body: unknown, status = 200, upstream?: Response) {
  const headers = upstream ? responseHeaders(upstream, { "content-type": "application/json" }) : new Headers();
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

async function toolRows(ctx: ProxyContext) {
  return ctx.db.select().from(tools).where(eq(tools.serverId, ctx.server.id));
}

async function toolRow(ctx: ProxyContext, name: string): Promise<ToolRow | undefined> {
  const [row] = await ctx.db
    .select()
    .from(tools)
    .where(and(eq(tools.serverId, ctx.server.id), eq(tools.name, name)));
  return row;
}

/** Add prices to tool descriptions + _meta; hide disabled tools and ones the owner hasn't synced yet. */
async function listTools(ctx: ProxyContext, message: JsonRpcRequest, raw: string) {
  const upstream = await forward(ctx, raw);
  const body = await upstream.text();
  const response = findResponse(body, upstream.headers.get("content-type"), message.id ?? null);
  if (!response?.result?.tools) {
    return new Response(body, { status: upstream.status, headers: responseHeaders(upstream) });
  }
  const rows = new Map((await toolRows(ctx)).map((t) => [t.name, t]));
  response.result.tools = (response.result.tools as any[])
    .filter((tool) => rows.get(tool.name)?.enabled === true)
    .map((tool) => {
      const row = rows.get(tool.name);
      const units = row ? BigInt(row.priceUnits) : 0n;
      if (units === 0n) return tool;
      return {
        ...tool,
        description: `${tool.description ?? ""} (costs ${formatUsd(units)} USDC per call)`.trim(),
        _meta: {
          ...tool._meta,
          [PRICE_META_KEY]: { amount: units.toString(), usd: formatUsd(units), network: ctx.server.network },
        },
      };
    });
  return json(response, 200, upstream);
}

async function callTool(ctx: ProxyContext, message: JsonRpcRequest, raw: string): Promise<Response> {
  const started = Date.now();
  const id = message.id ?? null;
  const name = message.params?.name;
  const row = typeof name === "string" ? await toolRow(ctx, name) : undefined;

  // A tool the upstream added after registration has no price yet; it stays closed until the
  // owner refreshes the server, so new tools are never served for free by accident.
  if (!row) return json(rpcError(id, -32602, `Unknown tool ${String(name)}`));
  if (!row.enabled) return json(rpcError(id, -32602, `Tool ${row.name} is disabled`));
  if (BigInt(row.priceUnits) === 0n) {
    const response = await passthrough(ctx, raw);
    await logCall(ctx, row, { status: "free", started });
    return response;
  }

  const { engine } = ctx;
  const params = message.params ?? {};
  const payload = readPaymentFromMeta(params._meta);
  const paymentRequired = async (error?: string) =>
    json(rpcResult(id, paymentRequiredToolResult(await engine.paymentRequired(ctx.server, row, error))));

  if (!payload) return paymentRequired();

  const requirements = await engine.match(ctx.server, row, payload);
  if (!requirements) return paymentRequired("Payment does not match this tool's price, asset or recipient");
  if (!(await engine.claim(payload))) return paymentRequired("Payment payload was already used");

  const verification = await engine.verify(payload, requirements);
  const payer = verification.payer;
  if (!verification.isValid) {
    const reason = verification.invalidReason ?? "Payment verification failed";
    await logCall(ctx, row, { status: "verify_failed", started, payer, error: reason });
    return paymentRequired(reason);
  }

  // The upstream never sees the payment; it gets a plain tools/call.
  const { [PAYMENT_META_KEY]: _payment, ...restMeta } = (params._meta ?? {}) as Record<string, unknown>;
  const forwarded: JsonRpcRequest = {
    ...message,
    params: { ...params, ...(Object.keys(restMeta).length ? { _meta: restMeta } : { _meta: undefined }) },
  };
  const upstream = await forward(ctx, JSON.stringify(forwarded));
  const body = await upstream.text();
  const response = findResponse(body, upstream.headers.get("content-type"), id);

  if (!response || response.error || response.result?.isError) {
    // Failed tool → no settlement; the signed auth entry simply expires.
    await logCall(ctx, row, {
      status: "tool_failed",
      started,
      payer,
      error: response?.error?.message ?? (response ? "Tool returned isError" : `Upstream HTTP ${upstream.status}`),
    });
    return response ? json(response, 200, upstream) : new Response(body, { status: upstream.status });
  }

  let settlement;
  try {
    settlement = await engine.settle(payload, requirements);
  } catch (error) {
    await logCall(ctx, row, { status: "payment_unknown", started, payer, amountUnits: requirements.amount, error: String(error) });
    // A timeout is not evidence of non-payment. Never return a new challenge that invites a second purchase.
    return json(rpcResult(id, { isError: true, content: [{ type: "text", text: "Payment outcome unknown. Do not automatically retry this purchase." }], _meta: { "stellarpay/payment-state": "unknown" } }), 200, upstream);
  }
  if (!settlement.success) {
    const reason = settlement.errorReason || "Settlement failed";
    await logCall(ctx, row, { status: "settle_failed", started, payer, error: String(reason) });
    return json(rpcResult(id, { isError: true, content: [{ type: "text", text: String(reason) }], _meta: { [PAYMENT_RESPONSE_META_KEY]: settlement } }), 200, upstream);
  }

  await logCall(ctx, row, {
    status: "paid",
    started,
    payer: settlement.payer ?? payer,
    amountUnits: requirements.amount,
    txHash: settlement.transaction,
  });
  ctx.log?.(`paid ${formatUsd(requirements.amount)} for ${ctx.server.id}/${row.name} tx=${settlement.transaction}`);
  const result = response.result ?? {};
  const paid: JsonRpcResponse = {
    ...response,
    result: { ...result, _meta: { ...result._meta, [PAYMENT_RESPONSE_META_KEY]: settlement } },
  };
  return json(paid, 200, upstream);
}

async function logCall(
  ctx: ProxyContext,
  tool: ToolRow,
  entry: {
    status: CallStatus;
    started: number;
    payer?: string;
    amountUnits?: string;
    txHash?: string;
    error?: string;
  },
) {
  try {
    await ctx.db.insert(calls).values({
      id: `call_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      serverId: ctx.server.id,
      tool: tool.name,
      payer: entry.payer ?? null,
      amountUnits: entry.amountUnits ?? "0",
      status: entry.status,
      txHash: entry.txHash ?? null,
      error: entry.error ?? null,
      latencyMs: Date.now() - entry.started,
    });
  } catch (error) {
    // Logging must never break a paid call.
    console.error("failed to log call", error);
  }
}
