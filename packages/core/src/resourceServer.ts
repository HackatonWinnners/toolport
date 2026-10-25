import { x402ResourceServer, type FacilitatorClient } from "@x402/core/server";
import type { PaymentRequirements } from "@x402/core/types";
import { ExactStellarScheme as ServerScheme } from "@x402/stellar/exact/server";
import { DEFAULT_NETWORK, networkInfo, type StellarNetwork } from "./constants.js";
import { createFacilitatorClient, type FacilitatorSettings } from "./facilitator.js";
import { fromUnits, normalizePrice, type PriceInput } from "./units.js";

export interface StellarResourceServerOptions {
  facilitator: FacilitatorSettings | FacilitatorClient;
  network?: StellarNetwork;
}

/**
 * x402 resource server for Stellar: builds payment requirements, verifies and settles
 * through the configured facilitator. Call `initialize()` (done here) before use.
 */
export async function createStellarResourceServer(options: StellarResourceServerOptions) {
  const network = options.network ?? DEFAULT_NETWORK;
  const client =
    "verify" in options.facilitator ? options.facilitator : createFacilitatorClient(options.facilitator);
  const server = new x402ResourceServer(client).register(network, new ServerScheme());
  await server.initialize();
  return server;
}

export interface RequirementInput {
  network?: StellarNetwork;
  payTo: string;
  /** USD price ("$0.01") — converted to USDC base units */
  price: PriceInput;
  maxTimeoutSeconds?: number;
}

/** Payment requirements for one tool call, priced in USDC on the given network. */
export async function buildToolRequirements(
  server: x402ResourceServer,
  input: RequirementInput,
): Promise<PaymentRequirements[]> {
  const network = input.network ?? DEFAULT_NETWORK;
  return server.buildPaymentRequirements({
    scheme: "exact",
    network,
    payTo: input.payTo,
    price: `$${normalizePrice(input.price)}`,
    maxTimeoutSeconds: input.maxTimeoutSeconds ?? 60,
  });
}

/** Sanity checks we run on top of the facilitator: right asset, recipient and amount. */
export function assertUsdcRequirement(req: PaymentRequirements, expected: { payTo: string; minUnits: bigint }) {
  const usdc = networkInfo(req.network).usdcContract;
  if (req.asset !== usdc) throw new Error(`Unexpected asset ${req.asset}, expected USDC ${usdc}`);
  if (req.payTo !== expected.payTo) throw new Error(`Unexpected payTo ${req.payTo}`);
  if (BigInt(req.amount) < expected.minUnits) {
    throw new Error(`Amount ${fromUnits(req.amount)} below price ${fromUnits(expected.minUnits)}`);
  }
}
