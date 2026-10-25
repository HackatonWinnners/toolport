import { Account, Address, Contract, Keypair, TransactionBuilder, nativeToScVal, FeeBumpTransaction } from "@stellar/stellar-sdk";
import { getNetworkPassphrase } from "@x402/stellar";
import { describe, expect, it } from "vitest";
import { networkInfo } from "../src/constants.js";
import { matchesTransfer } from "../src/settlement.js";
describe("on-chain receipt binding",()=>{
  it("matches actual USDC transfer arguments in normal and fee-bump transactions",()=>{
    const payer=Keypair.random(),payTo=Keypair.random(),facilitator=Keypair.random();
    const expected={network:"stellar:testnet" as const,payer:payer.publicKey(),payTo:payTo.publicKey(),amount:200000n};
    const tx=new TransactionBuilder(new Account(facilitator.publicKey(),"1"),{fee:"100",networkPassphrase:getNetworkPassphrase(expected.network)})
      .addOperation(new Contract(networkInfo(expected.network).usdcContract).call("transfer",new Address(expected.payer).toScVal(),new Address(expected.payTo).toScVal(),nativeToScVal(expected.amount,{type:"i128"}))).setTimeout(60).build();
    const bump=TransactionBuilder.buildFeeBumpTransaction(facilitator,"1000",tx,getNetworkPassphrase(expected.network));
    for(const envelope of [tx.toXDR(),bump.toXDR()]) {
      expect(matchesTransfer(envelope,expected)).toBe(true);
      expect(matchesTransfer(envelope,{...expected,amount:100000n})).toBe(false);
      expect(matchesTransfer(envelope,{...expected,payer:payTo.publicKey()})).toBe(false);
      expect(matchesTransfer(envelope,{...expected,network:"stellar:pubnet"})).toBe(false);
    }
  });
});
