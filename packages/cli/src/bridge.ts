import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { explorerTxUrl, formatUsd, type AgentStore, type StellarNetwork } from "@stellarpay/core";
import { PaymentRefusedError, SpendGuard, StellarPayClient, type SpendLimits } from "@stellarpay/mcp/client";

export interface BridgeOptions extends SpendLimits {
  urls: string[];
  secretKey: string;
  network: StellarNetwork;
  rpcUrl?: string;
  store?: AgentStore;
  verifyReceipts?: boolean;
}

const log = (...args: unknown[]) => console.error("[toolport]", ...args);

/**
 * Expose one or more remote (paid) MCP servers as a single local stdio MCP server.
 * The bridge pays for priced tools within the spend limits and tells the model what it paid.
 */
export async function runBridge(options: BridgeOptions) {
  const remotes: { url: string; client: StellarPayClient }[] = [];
  // One guard for every remote so the budget is global to the session.
  const guard = new SpendGuard(options);
  let address = "";
  for (const url of options.urls) {
    const client = new StellarPayClient({
      ...options,
      guard,
      clientInfo: { name: "stellarpay-bridge", version: "0.1.0" },
      onPayment: ({ tool, amount, settlement }) =>
        log(`paid ${formatUsd(amount)} for ${tool} → ${explorerTxUrl(settlement.transaction, options.network)}`),
    });
    await client.connect(url);
    address = client.address;
    remotes.push({ url, client });
    log(`connected ${url}`);
  }

  // Tool name → remote. Collisions get a numeric prefix so nothing is shadowed.
  const routes = new Map<string, { remote: (typeof remotes)[number]; name: string }>();
  const listTools = async (): Promise<Tool[]> => {
    routes.clear();
    const all: Tool[] = [];
    for (const [i, remote] of remotes.entries()) {
      const { tools } = await remote.client.listTools();
      for (const tool of tools) {
        const exposed = routes.has(tool.name) ? `s${i + 1}_${tool.name}` : tool.name;
        routes.set(exposed, { remote, name: tool.name });
        all.push({ ...tool, name: exposed });
      }
    }
    return all;
  };

  const server = new Server(
    { name: "stellarpay", version: "0.1.0" },
    { capabilities: { tools: { listChanged: false } } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: await listTools() }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!routes.size) await listTools();
    const route = routes.get(request.params.name);
    if (!route) return { isError: true, content: [{ type: "text", text: `Unknown tool ${request.params.name}` }] };
    const { client } = route.remote;
    try {
      const result = await client.callTool(route.name, request.params.arguments ?? {});
      const content = [...(result.content as any[])];
      if (result.paymentMade && result.paymentResponse?.success) {
        const budget = await client.budget();
        const unverified = (result as { paymentState?: string }).paymentState === "unverified";
        content.push({
          type: "text",
          text:
            `[StellarPay] Paid with USDC on Stellar. Transaction: ${explorerTxUrl(result.paymentResponse.transaction, options.network)}` +
            (unverified ? " (not yet confirmed on-chain; counted as pending). " : ". ") +
            `Session spend ${budget.spent} USDC, ${budget.pending} pending` +
            (budget.remaining !== null ? `, ${budget.remaining} USDC left.` : "."),
        });
      }
      return { content, isError: result.isError };
    } catch (error) {
      if (error instanceof PaymentRefusedError) {
        log(`refused ${route.name}: ${error.reason}`);
        return {
          isError: true,
          content: [{ type: "text", text: `Not paid: ${error.reason}. Ask the user to raise the limit if this tool is worth it.` }],
        };
      }
      log(`error calling ${route.name}:`, error);
      return { isError: true, content: [{ type: "text", text: `Tool call failed: ${(error as Error).message}` }] };
    }
  });

  let finish!: () => void;
  const closed = new Promise<void>((resolve) => { finish = resolve; });
  server.onclose = () => finish();
  await server.connect(new StdioServerTransport());
  log(
    `bridge ready: wallet ${address}, ${remotes.length} server(s)` +
      (options.maxPerCall !== undefined ? `, max $${options.maxPerCall}/call` : "") +
      (options.budget !== undefined ? `, budget $${options.budget}` : ""),
  );
  const stop = () => { void server.close(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try { await closed; } finally {
    process.off("SIGINT", stop); process.off("SIGTERM", stop);
    await Promise.allSettled(remotes.map((r) => r.client.close()));
  }

}
