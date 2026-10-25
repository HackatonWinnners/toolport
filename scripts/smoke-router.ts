import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Keypair } from "@stellar/stellar-sdk";
import { AgentStore } from "@stellarpay/core";
import { StellarPayClient } from "@stellarpay/mcp/client";
import { ToolCatalog, ToolRouter, providerFetch } from "@stellarpay/router";
import { resolveSecret } from "../packages/cli/src/wallet.js";

if (process.env.STELLAR_NETWORK && process.env.STELLAR_NETWORK !== "stellar:testnet") throw new Error("This smoke test only spends testnet USDC");
const secretKey=await resolveSecret();
const path=resolve(".wallets/router-smoke.db");await mkdir(dirname(path),{recursive:true,mode:0o700});
const store=await AgentStore.open({url:pathToFileURL(path).href,network:"stellar:testnet",payer:Keypair.fromSecret(secretKey).publicKey(),session:process.env.STELLARPAY_SMOKE_SESSION??"router-smoke-v1",budget:"1",maxPerCall:"0.05"});
try {
  const fetcher=providerFetch();
  const catalog=new ToolCatalog({network:"stellar:testnet",gatewayUrl:process.env.STELLARPAY_GATEWAY_URL??"https://stellarpay-gateway-ten.vercel.app",bazaarUrl:process.env.STELLARPAY_BAZAAR_URL??"https://testnet.rail402.dev",fetcher});
  const router=new ToolRouter(catalog,store,()=>new StellarPayClient({secretKey,store,maxPerCall:"0.05",budget:"1",verifyReceipts:true,fetcher}),"stellar:testnet",fetcher);
  const id=`registry:${process.env.STELLARPAY_SMOKE_SERVER_ID??"srv_02148cae805b"}:dex_best_path`;
  const input={id,args:{from:"XLM",to:"USDC",amount:"100"},maxAmount:"0.05",idempotencyKey:"router-smoke-paid-v1"};
  assert.equal((await router.quote(id,input.args,"0.05")).withinCap,true);
  const run=await router.invoke(input);
  assert.equal(run.status,"completed",JSON.stringify(run));
  const result=run.result as {verifiedOnChain:boolean;paymentResponse:{transaction:string}};
  assert.equal(result.verifiedOnChain,true);
  const before=await router.budget();
  const replay=await router.invoke(input);assert.equal(replay.id,run.id);assert.equal("replayed" in replay&&replay.replayed,true);
  const blocked=await router.invoke({...input,maxAmount:"0.001",idempotencyKey:"router-smoke-cap-v1"});
  assert.equal(blocked.status,"failed");assert.equal((blocked.error as any)?.paid,"none");
  const after=await router.budget();assert.equal(after.spent,before.spent);assert.equal(after.pending,"0");

  // A third-party seller found by plain-language search in Rail402's Bazaar, paid over HTTP x402.
  const query="what's the weather in Lisbon";
  const found=(await catalog.search(query,5)).tools.find((t)=>t.source==="rail402"&&t.transport==="http"&&/weather/i.test(`${t.title} ${t.description}`));
  assert.ok(found,`no Rail402 weather tool for "${query}"`);
  const external={id:found.id,args:{query:{city:"Lisbon"}},maxAmount:"0.01",idempotencyKey:"router-smoke-rail402-v1"};
  assert.equal((await router.quote(external.id,external.args,external.maxAmount)).withinCap,true);
  const externalRun=await router.invoke(external);
  assert.equal(externalRun.status,"completed",JSON.stringify(externalRun));
  const externalResult=externalRun.result as {status:number;body:unknown;verifiedOnChain:boolean;paymentResponse:{transaction:string}};
  assert.equal(externalResult.verifiedOnChain,true);
  const final=await router.budget();
  const proof={checkedAt:new Date().toISOString(),network:"stellar:testnet",asset:"USDC",toolId:id,runId:run.id,transaction:result.paymentResponse.transaction,explorerUrl:`https://stellar.expert/explorer/testnet/tx/${result.paymentResponse.transaction}`,verifiedOnChain:true,idempotentReplay:true,capRejectedWithoutPayment:true,
    rail402:{query,toolId:found.id,title:found.title,url:found.url,runId:externalRun.id,status:externalResult.status,body:externalResult.body,transaction:externalResult.paymentResponse.transaction,explorerUrl:`https://stellar.expert/explorer/testnet/tx/${externalResult.paymentResponse.transaction}`,verifiedOnChain:true},
    budget:final};
  await mkdir("docs/verification",{recursive:true});await writeFile("docs/verification/router-testnet.json",JSON.stringify(proof,null,2)+"\n");
  console.log(JSON.stringify(proof,null,2));
} finally {store.close();}
