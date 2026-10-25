import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { AgentStore } from "../src/agentStore.js";
const cleanup: (()=>Promise<unknown>|void)[]=[];
afterEach(async()=>{for(const fn of cleanup.splice(0).reverse())await fn();});
async function open(extra:Partial<Parameters<typeof AgentStore.open>[0]>={}) {
  const store=await AgentStore.open({url:":memory:",network:"stellar:testnet",payer:"GTEST",budget:"0.05",maxPerCall:"0.03",...extra});
  cleanup.push(()=>store.close());return store;
}
describe("durable wallet budgets and runs",()=>{
  it("atomically reserves across clients and counts unknown payments after reopening",async()=>{
    const dir=await mkdtemp(join(tmpdir(),"stellarpay-"));cleanup.push(()=>rm(dir,{recursive:true,force:true}));
    const url=pathToFileURL(join(dir,"agent.db")).href;
    const a=await open({url}),b=await open({url});
    const outcomes=await Promise.allSettled([a.reserve("a",300000n),b.reserve("b",300000n)]);
    expect(outcomes.filter((r)=>r.status==="fulfilled"&&r.value===null)).toHaveLength(1);
    expect((await a.budget()).pending).toBe("0.03");
    await a.resolve("a","unknown");await b.resolve("b","unknown");
    const restarted=await open({url});expect((await restarted.budget()).remaining).toBe("0.02");
    expect(await restarted.reserve("c",300000n)).toMatch(/budget/);
  });
  it("does not release an unknown hold or reset a session when its limits change",async()=>{
    const dir=await mkdtemp(join(tmpdir(),"stellarpay-"));cleanup.push(()=>rm(dir,{recursive:true,force:true}));
    const url=pathToFileURL(join(dir,"agent.db")).href,store=await open({url});
    await store.reserve("a",200000n);await store.resolve("a","unknown");await store.resolve("a","released");
    expect((await store.budget()).pending).toBe("0.02");
    const raised=await AgentStore.open({url,network:"stellar:testnet",payer:"GTEST",budget:"1",maxPerCall:"0.03"});cleanup.push(()=>raised.close());
    expect(await raised.budget()).toMatchObject({cap:"1",pending:"0.02",remaining:"0.98"});
    const other=await open({url,network:"stellar:pubnet"});expect((await other.budget()).pending).toBe("0");
  });
  it("accounts settlement once and releases only provably unsent reservations",async()=>{
    const store=await open();await store.reserve("a",200000n);await store.resolve("a","settled","tx");
    await store.resolve("a","settled","tx");await store.resolve("a","unknown");
    await store.reserve("b",100000n);await store.resolve("b","released");
    expect(await store.budget()).toMatchObject({spent:"0.02",pending:"0",remaining:"0.03"});
    expect(await store.reserve("a",200000n)).toMatch(/already exists/);
    expect(await store.reserve("large",400000n)).toMatch(/cap/);
  });
  it("claims a request once, rejects a changed request, and returns the original result",async()=>{
    const store=await open();const a=await store.claimRun("key",{x:1,y:2},"tool");
    expect(a.fresh).toBe(true);
    expect((await store.claimRun("key",{y:2,x:1},"tool")).fresh).toBe(false);
    await expect(store.claimRun("key",{x:3},"tool")).rejects.toThrow(/conflict/);
    await store.finishRun(a.run.id,"completed",{answer:42});
    expect((await store.claimRun("key",{x:1,y:2},"tool")).run.result).toEqual({answer:42});
  });
  it("settles unknown holds that verify on-chain and releases only on explicit request",async()=>{
    const store=await open();
    await store.reserve("verified",100000n);await store.resolve("verified","unknown","tx-ok");
    await store.reserve("bad-tx",100000n);await store.resolve("bad-tx","unknown","tx-bad");
    await store.reserve("no-tx",100000n);await store.resolve("no-tx","unknown");
    expect(await store.reconcile(async (tx)=>tx==="tx-ok")).toEqual(["verified"]);
    expect(await store.budget()).toMatchObject({spent:"0.01",pending:"0.02"});
    expect(await store.release("no-tx")).toBe(true);
    expect(await store.release("verified")).toBe(false);
    expect((await store.holds()).map((h)=>h.id)).toEqual(["bad-tx"]);
  });
});
