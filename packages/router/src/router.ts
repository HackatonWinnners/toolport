import { AgentStore, fromUnits, networkInfo, spendLimitUnits, toUnits, type PriceInput, type StellarNetwork } from "@stellarpay/core";
import { PaymentUnknownError, PaidResponseError, StellarPayClient } from "@stellarpay/mcp/client";
import type { ToolCatalog, ToolDescriptor } from "./catalog.js";
import { providerFetch } from "./network.js";
import type { PaymentRequired } from "@stellarpay/core";
export type ToolBuyer = Pick<StellarPayClient,"connect"|"close"|"callTool"|"quoteTool"|"callHttp"|"decodeHttpQuote">;
export interface Invocation { id:string; args:Record<string,unknown>; maxAmount:string; idempotencyKey:string; }
export interface RouterWallet { store:AgentStore; createBuyer:()=>ToolBuyer; }
export interface WalletSource {
  resolve():Promise<RouterWallet|null>;
  limits:{ maxPerCall:PriceInput; budget:PriceInput };
}
export const NO_WALLET="No wallet. Run `toolport wallet create` or /toolport:setup, then call again.";
export const fixedWallet=(wallet:RouterWallet,limits:WalletSource["limits"]):WalletSource=>({resolve:async()=>wallet,limits});

export class ToolRouter {
  private fetcher:typeof fetch;
  constructor(readonly catalog:ToolCatalog,private wallet:WalletSource,private createQuoteBuyer:()=>ToolBuyer,readonly network:StellarNetwork,fetcher?:typeof fetch) {
    this.fetcher=fetcher??providerFetch(catalog.options.allowLoopback);
  }
  private async paying() {
    const wallet=await this.wallet.resolve();
    if(!wallet)throw new Error(NO_WALLET);
    return wallet;
  }
  async quote(id:string,args:Record<string,unknown>,maxAmount:string) {
    const tool=await this.catalog.get(id);this.catalog.validate(tool,args);
    const buyer=this.createQuoteBuyer();
    try {
      let required:PaymentRequired;
      if(tool.transport==="mcp") {
        if(tool.priceUnits==="0")return {free:true,network:this.network,source:"registry metadata",note:"No tool executed"};
        await buyer.connect(tool.url);required=await buyer.quoteTool(tool.toolName!,args);
      } else {
        const target=httpTarget(tool,args);
        const response=await this.fetcher(target.url,target.init);
        try { if(response.status!==402)throw new Error(`Expected unpaid 402 challenge, received HTTP ${response.status}`);required=buyer.decodeHttpQuote(response); }
        finally { await response.body?.cancel(); }
      }
      const accepts=required.accepts.filter((a)=>a.scheme==="exact"&&a.network===this.network&&a.asset===networkInfo(this.network).usdcContract&&(!tool.payTo||a.payTo===tool.payTo));
      if(!accepts.length)throw new Error("Provider quote has no matching exact USDC option");
      return {network:this.network,asset:"USDC",accepts,withinCap:accepts.some((a)=>BigInt(a.amount)<=toUnits(maxAmount)),note:"Unpaid challenge; no signature created. Does not prove result quality."};
    } finally { await buyer.close(); }
  }
  async invoke(input:Invocation) {
    if(!input.idempotencyKey||input.idempotencyKey.length>200)throw new Error("idempotencyKey must contain 1–200 characters");
    if(toUnits(input.maxAmount)<=0n)throw new Error("maxAmount must be positive");
    const {store,createBuyer}=await this.paying();
    const claimed=await store.claimRun(input.idempotencyKey,{id:input.id,args:input.args,maxAmount:input.maxAmount},input.id);
    if(!claimed.fresh)return {...claimed.run,replayed:true};
    let buyer:ToolBuyer|undefined;
    try {
      const tool=await this.catalog.get(input.id);this.catalog.validate(tool,input.args);
      buyer=createBuyer();
      const options={id:claimed.run.id,maxPerCall:input.maxAmount,payTo:tool.payTo};
      let result;
      if(tool.transport==="mcp") { await buyer.connect(tool.url);result=await buyer.callTool(tool.toolName!,input.args,options); }
      else { const target=httpTarget(tool,input.args);result=await buyer.callHttp(target.url,target.init,options,this.fetcher); }
      const ok="kind" in result?result.status>=200&&result.status<300:!result.isError;
      return await store.finishRun(claimed.run.id,ok?"completed":"provider_error",result);
    } catch(error) {
      const unknown=error instanceof PaymentUnknownError;
      return await store.finishRun(claimed.run.id,unknown?"payment_unknown":error instanceof PaidResponseError?"provider_error":"failed",null,{
        message:error instanceof Error?error.message:String(error),paid:unknown?"unknown":error instanceof PaidResponseError?"settled":"none",
        ...(error instanceof PaidResponseError?{receipt:error.settlement}:error instanceof PaymentUnknownError&&error.receipt?{receipt:error.receipt}:{}),
      });
    } finally { if(buyer)await buyer.close().catch(()=>{}); }
  }
  async getRun(id:string) { return (await this.paying()).store.getRun(id); }
  async budget() {
    const wallet=await this.wallet.resolve();
    if(wallet)return wallet.store.budget();
    const {cap,perCall}=spendLimitUnits(this.wallet.limits);
    return {asset:"USDC",cap:fromUnits(cap),perCall:fromUnits(perCall),spent:"0",pending:"0",remaining:fromUnits(cap),wallet:null,note:NO_WALLET};
  }
}
function httpTarget(tool:ToolDescriptor,args:Record<string,unknown>) {
  let target=tool.url;
  for(const [k,v] of Object.entries((args.pathParams??{}) as Record<string,unknown>))target=target.replace(`:${k}`,encodeURIComponent(String(v))).replace(`{${k}}`,encodeURIComponent(String(v)));
  const url=new URL(target);
  for(const [k,v] of Object.entries((args.query??{}) as Record<string,unknown>))url.searchParams.set(k,String(v));
  const init: RequestInit = { method: tool.method ?? "GET" };
  if (args.body !== undefined) { init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify(args.body); }
  return { url: url.href, init };
}
