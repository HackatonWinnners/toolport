import { lt } from "drizzle-orm";
import { Address, TransactionBuilder, scValToNative } from "@stellar/stellar-sdk";
import { getNetworkPassphrase } from "@x402/stellar";
import { paymentClaims } from "./db/schema.js";
import type { Db } from "./db/index.js";
import type { FacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { PaymentPayload, PaymentRequired, PaymentRequirements } from "@x402/core/types";
import {
  fingerprint,
  buildToolRequirements,
  createStellarResourceServer,
  fromUnits,
  type FacilitatorSettings,
  type StellarNetwork,
} from "@stellarpay/core";
import type { ServerRow, ToolRow } from "./db/schema.js";

const REPLAY_TTL_MS = 10 * 60_000;

/** Prices, verifies and settles tool calls for every server behind the gateway. */
export class PaymentEngine {
  private server?: Promise<x402ResourceServer>;
  private requirementsCache = new Map<string, Promise<PaymentRequirements[]>>();

  constructor(
    private readonly options: {
      db: Db;
      facilitator: FacilitatorSettings | FacilitatorClient;
      network: StellarNetwork;
      publicUrl: string;
    },
  ) {}

  resourceServer(): Promise<x402ResourceServer> {
    if (!this.server) {
      this.server = createStellarResourceServer(this.options);
      this.server.catch(() => (this.server = undefined));
    }
    return this.server;
  }

  async requirements(server: ServerRow, tool: ToolRow): Promise<PaymentRequirements[]> {
    const key = `${server.network}|${server.payTo}|${tool.priceUnits}`;
    let cached = this.requirementsCache.get(key);
    if (!cached) {
      cached = this.resourceServer().then((rs) =>
        buildToolRequirements(rs, {
          network: server.network as StellarNetwork,
          payTo: server.payTo,
          price: fromUnits(tool.priceUnits),
        }),
      );
      cached.catch(() => this.requirementsCache.delete(key));
      this.requirementsCache.set(key, cached);
    }
    return cached;
  }

  async paymentRequired(server: ServerRow, tool: ToolRow, error?: string): Promise<PaymentRequired> {
    const rs = await this.resourceServer();
    return rs.createPaymentRequiredResponse(
      await this.requirements(server, tool),
      {
        url: `${this.options.publicUrl}/v1/mcp/${server.id}#tool=${encodeURIComponent(tool.name)}`,
        description: `${server.name}: ${tool.name}`,
        mimeType: "application/json",
      },
      error ?? "Payment required to call this tool",
    );
  }

  async match(server: ServerRow, tool: ToolRow, payload: PaymentPayload) {
    const rs = await this.resourceServer();
    return rs.findMatchingRequirements(await this.requirements(server, tool), payload);
  }

  /** Atomic shared claim: separate serverless instances cannot execute the same proof concurrently. */
  async claim(payload: PaymentPayload): Promise<boolean> {
    const now = new Date();
    await this.options.db.delete(paymentClaims).where(lt(paymentClaims.expiresAt, now));
    const claimed = await this.options.db.insert(paymentClaims).values({
      id: this.proofIdentity(payload), expiresAt: new Date(now.getTime() + REPLAY_TTL_MS),
    }).onConflictDoNothing().returning({ id: paymentClaims.id });
    return claimed.length === 1;
  }

  private proofIdentity(payload: PaymentPayload): string {
    const transaction = (payload.payload as Record<string,unknown>).transaction;
    if (typeof transaction !== "string") throw new Error("Missing Stellar payment transaction");
    try {
      const outer = TransactionBuilder.fromXDR(transaction,getNetworkPassphrase(this.options.network));
      const tx = "innerTransaction" in outer ? outer.innerTransaction : outer;
      for (const op of tx.operations) {
        if (op.type !== "invokeHostFunction" || op.func.switch().name !== "hostFunctionTypeInvokeContract") continue;
        const call = op.func.invokeContract();
        if (call.functionName().toString() !== "transfer") continue;
        const payer = scValToNative(call.args()[0]);
        for (const auth of op.auth ?? []) {
          if (auth.credentials().switch().name !== "sorobanCredentialsAddress") continue;
          const credential = auth.credentials().address();
          if (Address.fromScAddress(credential.address()).toString() === payer) {
            // Bind to the authorization nonce, not mutable envelope fees/sequence/JSON extras.
            return fingerprint({ network:this.options.network,payer,nonce:credential.nonce().toString() });
          }
        }
      }
    } catch { /* malformed proofs are still rejected by facilitator.verify before execution */ }
    return fingerprint({ network:this.options.network,transaction });
  }

  async verify(payload: PaymentPayload, requirements: PaymentRequirements) {
    return (await this.resourceServer()).verifyPayment(payload, requirements);
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements) {
    return (await this.resourceServer()).settlePayment(payload, requirements);
  }
}
