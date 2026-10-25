import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { FacilitatorClient } from "@x402/core/server";
import type { PaymentPayload, SettleResponse } from "@x402/core/types";
import { createPaymentWrapper, type MCPToolCallback, type ToolResult } from "@x402/mcp";
import {
  DEFAULT_NETWORK,
  PRICE_META_KEY,
  buildToolRequirements,
  createStellarResourceServer,
  formatUsd,
  toUnits,
  type FacilitatorSettings,
  type PriceInput,
  type StellarNetwork,
} from "@stellarpay/core";
import type { z } from "zod";

export interface PaidMcpOptions {
  /** Stellar address that receives USDC (G... with a USDC trustline, or C...) */
  payTo: string;
  facilitator: FacilitatorSettings | FacilitatorClient;
  network?: StellarNetwork;
  serverInfo?: { name: string; version: string };
  /** Called after every settled payment, e.g. to log revenue */
  onPayment?: (event: PaymentEvent) => void | Promise<void>;
}

export interface PaymentEvent {
  tool: string;
  amountUnits: string;
  payer?: string;
  settlement: SettleResponse;
}

type ZodShape = Record<string, z.ZodTypeAny>;
type ToolHandler<Shape extends ZodShape> = (
  args: z.objectOutputType<Shape, z.ZodTypeAny>,
) => ToolResult | Promise<ToolResult>;

export interface PaidMcpServer extends McpServer {
  /**
   * Register a tool that costs `price` USD (in USDC) per successful call.
   * Failed calls (`isError: true` or a thrown error) are never charged.
   */
  paidTool<Shape extends ZodShape>(
    name: string,
    description: string,
    price: PriceInput,
    inputShape: Shape,
    handler: ToolHandler<Shape>,
    annotations?: ToolAnnotations,
  ): void;
}

/**
 * Build a fetch-style handler (`(Request) => Promise<Response>`) for a stateless
 * Streamable-HTTP MCP server whose paid tools settle in USDC on Stellar via x402.
 *
 * Works with Hono (`app.all("/mcp", c => handler(c.req.raw))`), Next.js route handlers,
 * Bun, Deno and Cloudflare-style runtimes.
 */
export function createPaidMcpHandler(
  setup: (server: PaidMcpServer) => void | Promise<void>,
  options: PaidMcpOptions,
): (request: Request) => Promise<Response> {
  const network = options.network ?? DEFAULT_NETWORK;
  const serverInfo = options.serverInfo ?? { name: "stellarpay-mcp", version: "0.1.0" };
  // One resource server (and facilitator /supported lookup) for the process.
  let resourceServer: ReturnType<typeof createStellarResourceServer> | undefined;
  const getResourceServer = () => (resourceServer ??= createStellarResourceServer({ ...options, network }));
  // Payment wrappers are built once per tool and price, then reused across requests.
  const wrappers = new Map<string, Promise<<T extends Record<string, unknown>>(h: any) => MCPToolCallback<T>>>();

  const getWrapper = (tool: string, description: string, price: PriceInput) => {
    const key = `${tool}@${price}`;
    let wrapper = wrappers.get(key);
    if (!wrapper) {
      wrapper = (async () => {
        const rs = await getResourceServer();
        const accepts = await buildToolRequirements(rs, { network, payTo: options.payTo, price });
        return createPaymentWrapper(rs, {
          accepts,
          resource: { url: `mcp://tool/${tool}`, description, mimeType: "application/json" },
          hooks: {
            onAfterSettlement: async ({ settlement, paymentPayload }) => {
              await options.onPayment?.({
                tool,
                amountUnits: accepts[0].amount,
                payer: settlement.payer ?? payerOf(paymentPayload),
                settlement,
              });
            },
          },
        });
      })();
      // Don't cache a failed init (e.g. facilitator briefly down).
      wrapper.catch(() => wrappers.delete(key));
      wrappers.set(key, wrapper);
    }
    return wrapper;
  };

  const buildServer = async () => {
    const server = new McpServer(serverInfo) as PaidMcpServer;
    server.paidTool = (name, description, price, inputShape, handler, annotations) => {
      const units = toUnits(price);
      server.registerTool(
        name,
        {
          description: `${description} (costs ${formatUsd(units)} USDC per call)`,
          inputSchema: inputShape,
          annotations,
          _meta: { [PRICE_META_KEY]: { amount: units.toString(), usd: formatUsd(units), network } },
        },
        (async (args: Record<string, unknown>, extra: unknown) => {
          const wrap = await getWrapper(name, description, price);
          return wrap(handler as any)(args, extra);
        }) as any,
      );
    };
    await setup(server);
    return server;
  };

  return statelessHandler(buildServer);
}

/** A plain (free) stateless Streamable-HTTP MCP handler, e.g. an upstream to put behind the gateway. */
export function createMcpHandler(
  setup: (server: McpServer) => void | Promise<void>,
  serverInfo = { name: "mcp-server", version: "0.1.0" },
): (request: Request) => Promise<Response> {
  return statelessHandler(async () => {
    const server = new McpServer(serverInfo);
    await setup(server);
    return server;
  });
}

function statelessHandler(buildServer: () => Promise<McpServer>) {
  return async (request: Request) => {
    const server = await buildServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      // Stateless: each request gets a fresh server/transport pair.
      void transport.close();
      void server.close();
    }
  };
}

function payerOf(payload: PaymentPayload): string | undefined {
  const p = payload.payload as Record<string, unknown> | undefined;
  return typeof p?.from === "string" ? p.from : undefined;
}
