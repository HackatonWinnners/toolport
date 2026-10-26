import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Keypair } from "@stellar/stellar-sdk";
import { AgentStore, type StellarNetwork } from "@stellarpay/core";
import { StellarPayClient, type SpendLimits } from "@stellarpay/mcp/client";
import { ToolCatalog, ToolRouter, createRouterMcp, providerFetch, type CatalogOptions, type RouterWallet, type WalletSource } from "@stellarpay/router";

export interface RouterRunOptions extends CatalogOptions {
  maxPerCall: string;
  budget: string;
  network: StellarNetwork;
  rpcUrl?: string;
  resolveSecret: () => Promise<string | null>;
  openStore: (payer: string) => Promise<AgentStore>;
}

export function lazyWallet(options: SpendLimits & { maxPerCall: string; budget: string; network: StellarNetwork; rpcUrl?: string; fetcher: typeof fetch; resolveSecret: () => Promise<string | null>; openStore: (payer: string) => Promise<AgentStore> }) {
  const stores = new Map<string, Promise<AgentStore>>();
  const storeFor = (payer: string) => {
    let pending = stores.get(payer);
    if (!pending) {
      pending = options.openStore(payer);
      stores.set(payer, pending);
      pending.catch(() => stores.delete(payer));
    }
    return pending;
  };
  const source: WalletSource = {
    limits: { maxPerCall: options.maxPerCall, budget: options.budget },
    async resolve(): Promise<RouterWallet | null> {
      const secretKey = await options.resolveSecret();
      if (!secretKey) return null;
      const store = await storeFor(Keypair.fromSecret(secretKey).publicKey());
      return {
        store,
        createBuyer: () => new StellarPayClient({ secretKey, store, network: options.network, rpcUrl: options.rpcUrl, fetcher: options.fetcher, verifyReceipts: true, maxPerCall: options.maxPerCall, budget: options.budget }),
      };
    },
  };
  const close = async () => {
    for (const pending of stores.values()) await pending.then((store) => store.close(), () => {});
  };
  return { source, close };
}

export async function runRouter(options: RouterRunOptions) {
  const fetcher = providerFetch(options.allowLoopback);
  const catalog = new ToolCatalog({ ...options, fetcher });
  await catalog.refresh();
  const wallet = lazyWallet({ ...options, fetcher });
  const quoteBuyer = () => new StellarPayClient({ secretKey: Keypair.random().secret(), network: options.network, rpcUrl: options.rpcUrl, fetcher });
  const router = new ToolRouter(catalog, wallet.source, quoteBuyer, options.network, fetcher);
  const server = createRouterMcp(router);
  let finish!: () => void;
  const closed = new Promise<void>((resolve) => { finish = resolve; });
  server.server.onclose = () => finish();
  await server.connect(new StdioServerTransport());
  const budget = await router.budget().then((b) => JSON.stringify(b), (error) => `unavailable (${error instanceof Error ? error.message : error})`);
  console.error("[toolport] discovery MCP ready; persistent budget", budget);
  const stop = () => { void server.close(); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await closed;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await wallet.close();
  }
}
