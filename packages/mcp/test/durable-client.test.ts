import { Keypair } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentStore, NETWORKS } from "@stellarpay/core";
const onChain=vi.hoisted(()=>({verified:true}));
vi.mock("@stellarpay/core",async(original)=>({...(await original<typeof import("@stellarpay/core")>()),verifySettlement:async()=>onChain.verified}));
vi.mock("@x402/stellar/exact/client",()=>({ExactStellarScheme:class {scheme="exact";async createPaymentPayload(){return {x402Version:2,payload:{transaction:"fake-test-signature"}};}}}));
import { StellarPayClient, PaymentUnknownError } from "../src/client.js";
const stores:AgentStore[]=[];
afterEach(()=>{for(const s of stores.splice(0))s.close();});
const url="https://provider.example/tool";
async function setup() {
  const secretKey=Keypair.random().secret();
  const store=await AgentStore.open({url:":memory:",network:"stellar:testnet",payer:Keypair.fromSecret(secretKey).publicKey(),budget:"0.02",maxPerCall:"0.02"});stores.push(store);
  return {store,client:new StellarPayClient({secretKey,store,maxPerCall:"0.02",budget:"0.02"})};
}
function challenge(amount="200000") {
  return new Response(null,{status:402,headers:{"PAYMENT-REQUIRED":Buffer.from(JSON.stringify({x402Version:2,resource:{url},accepts:[{scheme:"exact",network:"stellar:testnet",asset:NETWORKS["stellar:testnet"].usdcContract,amount,payTo:Keypair.random().publicKey(),maxTimeoutSeconds:60,extra:{areFeesSponsored:true}}]})).toString("base64")}});
}
describe("payment accounting across HTTP outcomes",()=>{
  it("keeps the budget held if the paid request loses its response",async()=>{
    const {client,store}=await setup();let sends=0;
    const fetcher=vi.fn(async()=>{if(++sends===1)return challenge();throw new Error("response lost after possible settlement");}) as unknown as typeof fetch;
    await expect(client.callHttp(url,{}, {},fetcher)).rejects.toBeInstanceOf(PaymentUnknownError);
    expect(await store.budget()).toMatchObject({spent:"0",pending:"0.02",remaining:"0"});
    expect(await store.reserve("another",200000n)).toMatch(/budget/);
  });
  it("settles the selected amount, preserving receipt even for a provider HTTP error",async()=>{
    const {client,store}=await setup();let sends=0;
    const fetcher=vi.fn(async()=>++sends===1?challenge():new Response('{"error":"provider failure"}',{status:500,headers:{"PAYMENT-RESPONSE":Buffer.from(JSON.stringify({success:true,network:"stellar:testnet",transaction:"tx123",payer:client.address})).toString("base64")}})) as unknown as typeof fetch;
    const result=await client.callHttp(url,{}, {},fetcher);expect(result.status).toBe(500);
    expect(await store.budget()).toMatchObject({spent:"0.02",pending:"0",remaining:"0"});
  });
  it("treats a missing or wrong-network receipt as unknown",async()=>{
    for(const receipt of [undefined,{success:true,network:"stellar:pubnet",transaction:"wrong"}]) {
      const {client,store}=await setup();let sends=0;
      const fetcher=vi.fn(async()=>++sends===1?challenge():new Response('{}',{headers:receipt?{"PAYMENT-RESPONSE":Buffer.from(JSON.stringify(receipt)).toString("base64")}:{}})) as unknown as typeof fetch;
      await expect(client.callHttp(url,{}, {},fetcher)).rejects.toBeInstanceOf(PaymentUnknownError);
      expect((await store.budget()).pending).toBe("0.02");
    }
  });
  it("refuses a quote above the explicit cap before sending a proof",async()=>{
    const {client,store}=await setup();const fetcher=vi.fn(async()=>challenge()) as unknown as typeof fetch;
    await expect(client.callHttp(url,{}, {maxPerCall:"0.01"},fetcher)).rejects.toThrow(/cap/);
    expect(fetcher).toHaveBeenCalledTimes(1);expect((await store.budget()).pending).toBe("0");
  });
  it("returns a paid result whose receipt is not on-chain yet, keeping the hold for reconciliation",async()=>{
    const secretKey=Keypair.random().secret();
    const store=await AgentStore.open({url:":memory:",network:"stellar:testnet",payer:Keypair.fromSecret(secretKey).publicKey(),budget:"0.02",maxPerCall:"0.02"});stores.push(store);
    const client=new StellarPayClient({secretKey,store,maxPerCall:"0.02",budget:"0.02",verifyReceipts:true});
    let sends=0;
    const fetcher=vi.fn(async()=>++sends===1?challenge():new Response('{"answer":42}',{headers:{"PAYMENT-RESPONSE":Buffer.from(JSON.stringify({success:true,network:"stellar:testnet",transaction:"a".repeat(64),payer:client.address})).toString("base64")}})) as unknown as typeof fetch;
    onChain.verified=false;
    try {
      const result=await client.callHttp(url,{},{},fetcher) as any;
      expect(result.body).toEqual({answer:42});
      expect(result).toMatchObject({paymentState:"unverified",verifiedOnChain:false,amountUnits:200000n});
      expect(await store.budget()).toMatchObject({spent:"0",pending:"0.02"});
      expect(await store.holds()).toEqual([{id:result.reservationId,amount:"0.02",state:"unknown",transaction:"a".repeat(64)}]);
      onChain.verified=true;
      expect(await store.reconcile(async()=>true)).toEqual([result.reservationId]);
      expect((await store.budget()).spent).toBe("0.02");
    } finally { onChain.verified=true; }
  });
});
