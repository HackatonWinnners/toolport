import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AgentStore, NETWORKS } from "@stellarpay/core";
import { PaymentUnknownError } from "@stellarpay/mcp/client";
import { ToolCatalog, ToolRouter, createRouterMcp, isPrivate, providerFetch, type ToolBuyer } from "../src/index.js";
const cleanup:(()=>Promise<unknown>|void)[]=[];
afterEach(async()=>{for(const fn of cleanup.splice(0).reverse())await fn();});
const entry={id:"search",title:"Search web",description:"Useful search",network:"stellar:testnet",transport:"http",method:"POST",url:"https://provider.example/search",inputSchema:{type:"object",properties:{body:{type:"object",properties:{query:{type:"string"}},required:["query"],additionalProperties:false}},required:["body"],additionalProperties:false}};
async function setup(mode:"ok"|"unknown"|"error"="ok") {
  const dir=await mkdtemp(join(tmpdir(),"stellarpay-router-"));cleanup.push(()=>rm(dir,{recursive:true,force:true}));
  const manifestPath=join(dir,"tools.json");await writeFile(manifestPath,JSON.stringify([entry]));
  const store=await AgentStore.open({url:":memory:",network:"stellar:testnet",payer:"GTEST",maxPerCall:"0.05",budget:"1"});cleanup.push(()=>store.close());
  const catalog=new ToolCatalog({network:"stellar:testnet",manifestPath});
  const call=vi.fn(async(_url:string,_init:RequestInit,options:any)=>{
    expect(await store.reserve(options.id,200000n)).toBeNull();
    if(mode==="unknown") {await store.resolve(options.id,"unknown");throw new PaymentUnknownError(options.id);}
    await store.resolve(options.id,"settled","tx");
    return {kind:"http" as const,status:mode==="error"?500:200,body:{answer:"useful"},paymentMade:true,paymentResponse:{success:true,network:"stellar:testnet" as const,transaction:"tx"}};
  });
  const required={x402Version:2,resource:{url:"https://provider.example/search"},accepts:[{scheme:"exact",network:"stellar:testnet" as const,asset:NETWORKS["stellar:testnet"].usdcContract,amount:"200000",payTo:"GSELLER",maxTimeoutSeconds:60,extra:{}}]};
  const buyer:ToolBuyer={connect:vi.fn(async()=>{}),close:vi.fn(async()=>{}),callHttp:call,callTool:vi.fn(),quoteTool:vi.fn(),decodeHttpQuote:()=>required};
  const fetcher=vi.fn(async()=>new Response(null,{status:402})) as unknown as typeof fetch;
  return {store,catalog,call,buyer,manifestPath,router:new ToolRouter(catalog,store,()=>buyer,"stellar:testnet",fetcher)};
}
const request={id:"manifest:search",args:{body:{query:"stellar"}},maxAmount:"0.05",idempotencyKey:"one"};
describe("discovery router",()=>{
  it("exposes six MCP tools and searches provider schemas through the real MCP protocol",async()=>{
    const {router}=await setup();const server=createRouterMcp(router),client=new Client({name:"test",version:"1"});
    const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b);
    cleanup.push(()=>server.close());cleanup.push(()=>client.close());
    expect((await client.listTools()).tools.map((t)=>t.name)).toEqual(["search_tools","get_tool","probe_tool","invoke_tool","get_run","get_budget"]);
    const search=await client.callTool({name:"search_tools",arguments:{query:"search"}}) as any;
    expect(JSON.parse(search.content[0].text).tools[0].id).toBe("manifest:search");
    const bad=await client.callTool({name:"invoke_tool",arguments:{...request,maxAmount:"0"}}) as any;expect(bad.isError).toBe(true);
  });
  it("pays once under concurrent duplicate requests and returns the stored result on retry",async()=>{
    const {router,call,store}=await setup();
    const [a,b]=await Promise.all([router.invoke(request),router.invoke(request)]);
    expect(a.id).toBe(b.id);expect(call).toHaveBeenCalledTimes(1);
    const replay=await router.invoke(request);expect(replay.status).toBe("completed");expect(replay).toHaveProperty("replayed",true);
    expect((await store.budget()).spent).toBe("0.02");
    await expect(router.invoke({...request,args:{body:{query:"changed"}}})).rejects.toThrow(/conflict/);
  });
  it("validates provider arguments before buying and preserves paid provider errors",async()=>{
    const {router,call}=await setup("error");
    const invalid=await router.invoke({...request,args:{body:{other:1}}});expect(invalid.status).toBe("failed");expect(call).not.toHaveBeenCalled();
    const error=await router.invoke({...request,idempotencyKey:"valid"});expect(error.status).toBe("provider_error");
    expect(error.result).toMatchObject({status:500,paymentMade:true});
  });
  it("stores unknown payment state and never buys it again for the same request",async()=>{
    const {router,call,store}=await setup("unknown");
    expect((await router.invoke(request)).status).toBe("payment_unknown");
    expect((await router.invoke(request)).status).toBe("payment_unknown");
    expect(call).toHaveBeenCalledTimes(1);expect((await store.budget()).pending).toBe("0.02");
  });
  it("probes without purchasing and returns an old run even if its source later disappears",async()=>{
    const {router,call,catalog,manifestPath}=await setup();
    expect(await router.quote(request.id,request.args,"0.01")).toMatchObject({withinCap:false});expect(call).not.toHaveBeenCalled();
    await router.invoke(request);await writeFile(manifestPath,"[]");await catalog.refresh();
    expect((await router.invoke(request)).status).toBe("completed");expect(call).toHaveBeenCalledTimes(1);
  });
  it("keeps local search working when an external registry fails, and filters mismatched networks",async()=>{
    const {manifestPath}=await setup();
    const catalog=new ToolCatalog({network:"stellar:testnet",manifestPath,gatewayUrl:"https://offline.example",fetcher:vi.fn(async()=>{throw new Error("offline");})});
    expect(await catalog.search("search")).toMatchObject({indexed:1,sources:[{source:"manifest",status:"ok"},{source:"registry",status:"unavailable"}]});
    const pubnet=new ToolCatalog({network:"stellar:pubnet",manifestPath});expect((await pubnet.search()).indexed).toBe(0);
  });
});
describe("provider network guard",()=>{
  it.each(["127.0.0.1","10.1.2.3","169.254.169.254","::1","::ffff:127.0.0.1","::ffff:7f00:1","fc00::1"])("recognizes private %s",(address)=>{expect(isPrivate(address)).toBe(true);});
  it("refuses private, credentialed and non-HTTP targets before sending a request",async()=>{
    for(const url of ["http://127.0.0.1:4021","https://u:password@example.com","file:///etc/passwd"])await expect(providerFetch()(url)).rejects.toThrow();
  });
  it("ranks Bazaar listings by Rail402's own search and falls back to lexical when it fails",async()=>{
    const usdc=NETWORKS["stellar:testnet"].usdcContract;
    const item=(id:string,name:string,description:string)=>({type:"http",resource:`https://seller.example/${id}`,serviceName:name,description,
      accepts:[{scheme:"exact",network:"stellar:testnet",asset:usdc,amount:"10000",payTo:"GSELLER"}],rail402:{listings:[{id,network:"stellar:testnet"}]},
      extensions:{bazaar:{schema:{properties:{input:{properties:{queryParams:{type:"object",properties:{city:{type:"string"}}}},required:["queryParams"]}}}}}});
    const items=[item("translate","Translate text","Translate a short text"),item("weather","Current weather","Conditions for a city")];
    let searchUp=true;
    const fetcher=vi.fn(async(url:string)=>{
      if(url.includes("/discovery/resources"))return Response.json({items,pagination:{total:items.length}});
      if(url.includes("/discovery/search")&&searchUp)return Response.json({resources:[items[1]]});
      return new Response("down",{status:503});
    }) as unknown as typeof fetch;
    const catalog=new ToolCatalog({network:"stellar:testnet",bazaarUrl:"https://bazaar.example",fetcher});
    await catalog.refresh();
    // "Is it raining in Lisbon" shares no word with the weather listing; only Rail402's ranking finds it.
    const smart=await catalog.search("is it raining in Lisbon");
    expect(smart.searchMode).toBe("lexical+rail402");
    expect(smart.tools.map((t)=>t.id)).toEqual(["rail402:weather"]);
    expect(smart.tools[0].inputSchema).toMatchObject({required:["query"]});
    searchUp=false;
    const plain=await catalog.search("translate");
    expect(plain.searchMode).toBe("lexical");
    expect(plain.tools.map((t)=>t.id)).toEqual(["rail402:translate"]);
  });
});
