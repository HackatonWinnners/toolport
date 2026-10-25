import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AgentStore, type StellarNetwork } from "@stellarpay/core";
import { StellarPayClient, type SpendLimits } from "@stellarpay/mcp/client";
import { ToolCatalog, ToolRouter, createRouterMcp, providerFetch, type CatalogOptions } from "@stellarpay/router";
export async function runRouter(options: CatalogOptions & SpendLimits & { secretKey:string; network:StellarNetwork; rpcUrl?:string; store:AgentStore }) {
  const fetcher=providerFetch(options.allowLoopback);
  const catalog=new ToolCatalog({...options,fetcher});
  await catalog.refresh();
  const router=new ToolRouter(catalog,options.store,()=>new StellarPayClient({...options,fetcher,verifyReceipts:true}),options.network,fetcher);
  const server=createRouterMcp(router);
  let finish!:()=>void;
  const closed=new Promise<void>((resolve)=>{finish=resolve;});
  server.server.onclose=()=>finish();
  await server.connect(new StdioServerTransport());
  console.error("[toolport] discovery MCP ready; persistent budget",JSON.stringify(await router.budget()));
  const stop=()=>{void server.close();};
  process.once("SIGINT",stop);process.once("SIGTERM",stop);
  try {await closed;} finally {process.off("SIGINT",stop);process.off("SIGTERM",stop);}
}
