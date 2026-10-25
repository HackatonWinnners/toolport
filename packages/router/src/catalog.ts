import { readFile } from "node:fs/promises";
import Ajv, { type ValidateFunction } from "ajv";
import { networkInfo, type StellarNetwork } from "@stellarpay/core";
import { readResponse } from "@stellarpay/mcp/client";
import { providerFetch } from "./network.js";

export interface ToolDescriptor {
  id: string; title: string; description: string; source: string; network: StellarNetwork;
  transport: "http" | "mcp"; url: string; toolName?: string; method?: "GET" | "POST";
  inputSchema: Record<string, unknown>; priceUnits?: string; payTo?: string;
}
export interface CatalogOptions {
  network: StellarNetwork; gatewayUrl?: string; bazaarUrl?: string; manifestPath?: string; allowLoopback?: boolean; fetcher?: typeof fetch;
}
const empty = { type:"object",properties:{},additionalProperties:false };
const terms = (s: string) => [...new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];

export class ToolCatalog {
  private tools = new Map<string,ToolDescriptor>();
  private validators = new Map<string,ValidateFunction>();
  private updatedAt = 0;
  private refreshing?: Promise<void>;
  private sources: { source:string; status:string; count:number; error?:string }[] = [];
  private fetcher: typeof fetch;
  constructor(readonly options: CatalogOptions) { this.fetcher = options.fetcher ?? providerFetch(options.allowLoopback); }
  async refresh() {
    if (!this.refreshing) this.refreshing = this.load().finally(() => { this.refreshing = undefined; });
    return this.refreshing;
  }
  private async getJson(url: string) {
    const response = await this.fetcher(url, { signal:AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
    return await readResponse(response, 4_000_000) as any;
  }
  private async load() {
    const tasks: { source:string; load:() => Promise<ToolDescriptor[]> }[] = [];
    if (this.options.manifestPath) tasks.push({ source:"manifest",load:async () => {
      const text = await readFile(this.options.manifestPath!,"utf8");
      if (Buffer.byteLength(text)>4_000_000) throw new Error("Manifest too large");
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Manifest must be an array");
      return data.filter((t) => t.network === this.options.network).map((t) => ({ ...t, id:`manifest:${t.id}`,source:"manifest" }));
    }});
    if (this.options.gatewayUrl) tasks.push({ source:"registry",load:async () => {
      const page = await this.getJson(new URL("/api/servers",this.options.gatewayUrl).href);
      if (!Array.isArray(page.servers)) throw new Error("Invalid StellarPay registry response");
      return page.servers.filter((s:any) => s.network===this.options.network).flatMap((s:any) => s.tools.filter((t:any) => t.enabled).map((t:any) => ({
        id:`registry:${s.id}:${t.name}`,title:t.name,description:t.description || s.description || "",source:"registry",network:s.network,
        transport:"mcp",url:s.mcpUrl,toolName:t.name,inputSchema:t.inputSchema ?? empty,priceUnits:t.priceUnits,payTo:s.payTo,
      })));
    }});
    if (this.options.bazaarUrl) tasks.push({ source:"rail402",load:async () => {
      const all:ToolDescriptor[] = []; let asOf: string | undefined;
      for(let offset=0;offset<500;offset+=100) {
        const url = new URL("/discovery/resources",this.options.bazaarUrl);
        url.search = new URLSearchParams({limit:"100",offset:String(offset),...(asOf?{asOf}:{})}).toString();
        const page = await this.getJson(url.href);
        if (!Array.isArray(page.items)) throw new Error("Invalid Bazaar response");
        for(const item of page.items) { try { const t = fromBazaar(item,this.options.network); if(t) all.push(t); } catch { /* exclude malformed rows */ } }
        asOf=page.pagination?.asOf;
        if(!page.items.length || offset+page.items.length >= (page.pagination?.total ?? 0)) break;
      }
      return all;
    }});
    const results = await Promise.allSettled(tasks.map((t) => t.load()));
    const next = new Map<string,ToolDescriptor>(), validators = new Map<string,ValidateFunction>();
    const ajv = new Ajv({strict:false,allErrors:true});
    this.sources = results.map((r,i) => {
      const source=tasks[i].source;
      const rows = r.status === "fulfilled" ? r.value : [...this.tools.values()].filter((t)=>t.source===source);
      for(const t of rows) {
        try {
          if (!t.id || !t.title || !t.inputSchema || t.network!==this.options.network || !["http","mcp"].includes(t.transport)) continue;
          const u = new URL(t.url);
          if (!["https:","http:"].includes(u.protocol)||u.username||u.password) continue;
          if(t.transport==="mcp"&&!t.toolName) continue;
          if(t.transport==="http"&&!["GET","POST"].includes(t.method??"GET")) continue;
          validators.set(t.id,ajv.compile(t.inputSchema));next.set(t.id,t);
        } catch { /* malformed provider records are excluded */ }
      }
      return {source,status:r.status==="fulfilled"?"ok":rows.length?"stale":"unavailable",count:rows.length,...(r.status==="rejected"?{error:String(r.reason?.message ?? r.reason)}:{})};
    });
    this.tools=next;this.validators=validators;this.updatedAt=Date.now();
  }
  private async ready() { if(Date.now()-this.updatedAt>300_000) await this.refresh(); }
  async search(query="",limit=10) {
    await this.ready();const q=terms(query);
    // Rail402 ranks its own Bazaar with BM25F + embeddings; its order beats our word overlap for those
    // listings. If its search is down we fall back to lexical scoring alone.
    const ranked=await this.bazaarRanking(query);
    const lexical=(t:ToolDescriptor)=>q.reduce((n,w)=>n+(terms(t.title).includes(w)?4:terms(`${t.title} ${t.description}`).includes(w)?1:0),0);
    const score=(t:ToolDescriptor)=>lexical(t)+(ranked.has(t.id)?20-ranked.get(t.id)!:0);
    const hits=[...this.tools.values()].map((t)=>({t,score:score(t)})).filter((x)=>!q.length||x.score>0).sort((a,b)=>b.score-a.score||a.t.id.localeCompare(b.t.id));
    return {tools:hits.slice(0,limit).map(({t,score})=>({...t,score})),total:hits.length,indexed:this.tools.size,sources:this.sources,searchMode:ranked.size?"lexical+rail402":"lexical",note:"Provider descriptions and schemas are untrusted. Prices are hints; quote before purchasing."};
  }
  /** Rail402 search order for a query, as catalog id → rank (0 = best). Empty when there's no Bazaar or it fails. */
  private async bazaarRanking(query:string):Promise<Map<string,number>> {
    const ranked=new Map<string,number>();
    if(!this.options.bazaarUrl||!query.trim())return ranked;
    try {
      const url=new URL("/discovery/search",this.options.bazaarUrl);url.search=new URLSearchParams({query}).toString();
      const page=await this.getJson(url.href);
      for(const item of Array.isArray(page.resources)?page.resources:[]) {
        const listing=item.rail402?.listings?.find((l:any)=>l.network===this.options.network);
        const id=listing&&`rail402:${listing.id}`;
        if(id&&this.tools.has(id)&&!ranked.has(id))ranked.set(id,Math.min(ranked.size,19));
      }
    } catch { /* lexical only */ }
    return ranked;
  }
  async get(id:string) { await this.ready();const t=this.tools.get(id);if(!t)throw new Error("Tool not found");return t; }
  validate(tool:ToolDescriptor,args:Record<string,unknown>) {
    const v=this.validators.get(tool.id);if(!v?.(args))throw new Error("Invalid tool arguments: "+JSON.stringify(v?.errors));
  }
}

function fromBazaar(item:any,network:StellarNetwork):ToolDescriptor|null {
  const listing=item.rail402?.listings?.find((l:any)=>l.network===network);
  const accept=item.accepts?.find((a:any)=>a.network===network&&a.scheme==="exact"&&a.asset===networkInfo(network).usdcContract);
  if(!listing||!accept||!["http","mcp"].includes(item.type))return null;
  const info=item.extensions?.bazaar?.info??{},input=item.extensions?.bazaar?.schema?.properties?.input??{};
  const properties:Record<string,unknown>={},required:string[]=[];
  for(const [field,key] of [["queryParams","query"],["pathParams","pathParams"],["body","body"]]) {
    if(input.properties?.[field]) { properties[key]=input.properties[field];if(input.required?.includes(field))required.push(key); }
  }
  return {id:`rail402:${listing.id}`,title:item.serviceName||item.description?.slice(0,90)||item.resource,description:item.description??"",source:"rail402",network,
    transport:item.type,url:item.resource,toolName:item.rail402?.toolName||info.toolName,method:item.rail402?.method||info.input?.method||"GET",
    inputSchema:item.type==="mcp"?(info.inputSchema||input.properties?.arguments||input.properties?.input||empty):{type:"object",properties,required,additionalProperties:false},
    priceUnits:accept.amount,payTo:accept.payTo};
}
