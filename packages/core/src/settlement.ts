import { Address, TransactionBuilder, rpc, scValToNative } from "@stellar/stellar-sdk";
import { getNetworkPassphrase } from "@x402/stellar";
import { networkInfo, type StellarNetwork } from "./constants.js";
/** `payTo` may be omitted when reconciling an old hold whose recipient wasn't recorded. */
export interface ExpectedTransfer { network:StellarNetwork; payer:string; payTo?:string; amount:bigint; }
/** Validate the actual successful transaction, not just a merchant-supplied hash. */
export function matchesTransfer(envelope:string,expected:ExpectedTransfer):boolean {
  const outer=TransactionBuilder.fromXDR(envelope,getNetworkPassphrase(expected.network));
  const tx="innerTransaction" in outer?outer.innerTransaction:outer;
  return tx.operations.some((op)=>{
    if(op.type!=="invokeHostFunction"||op.func.switch().name!=="hostFunctionTypeInvokeContract")return false;
    const call=op.func.invokeContract();
    if(Address.fromScAddress(call.contractAddress()).toString()!==networkInfo(expected.network).usdcContract||call.functionName().toString()!=="transfer")return false;
    const args=call.args().map((v)=>scValToNative(v));
    return args.length===3&&args[0]===expected.payer&&(expected.payTo===undefined||args[1]===expected.payTo)&&BigInt(args[2])===expected.amount;
  });
}
export async function verifySettlement(transaction:string,rpcUrl:string,expected:ExpectedTransfer):Promise<boolean> {
  if(!/^[a-f0-9]{64}$/i.test(transaction))return false;
  const server=new rpc.Server(rpcUrl,{timeout:10});
  // The facilitator returns once the transaction is in a ledger, but the RPC node may index it a bit later.
  const attempts=8;
  for(let attempt=0;attempt<attempts;attempt++) {
    const result=await server.getTransaction(transaction);
    if(result.status==="SUCCESS")return matchesTransfer(result.envelopeXdr.toXDR("base64"),expected);
    if(result.status==="FAILED")return false;
    if(attempt<attempts-1)await new Promise((resolve)=>setTimeout(resolve,750));
  }
  return false;
}
