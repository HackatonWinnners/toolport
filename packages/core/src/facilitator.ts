import { x402Facilitator } from "@x402/core/facilitator";
import { HTTPFacilitatorClient, type FacilitatorClient } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements, SupportedResponse } from "@x402/core/types";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme as FacilitatorScheme } from "@x402/stellar/exact/facilitator";
import { DEFAULT_NETWORK, networkInfo, type StellarNetwork } from "./constants.js";

/**
 * Where payments get verified and settled.
 * - `http`: a hosted facilitator (OpenZeppelin channels, Coinbase, or our apps/facilitator)
 * - `local`: verify + settle in-process with our own fee-paying account (no API key needed)
 */
export type FacilitatorSettings =
  | { kind: "http"; url: string; apiKey?: string }
  | { kind: "local"; secretKey: string; network?: StellarNetwork; rpcUrl?: string };

export const OPENZEPPELIN_TESTNET_FACILITATOR = "https://channels.openzeppelin.com/x402/testnet";
export const OPENZEPPELIN_PUBNET_FACILITATOR = "https://channels.openzeppelin.com/x402";

export function createFacilitatorClient(settings: FacilitatorSettings): FacilitatorClient {
  if (settings.kind === "http") {
    const { apiKey } = settings;
    return new HTTPFacilitatorClient({
      url: settings.url,
      createAuthHeaders: apiKey
        ? async () => {
            const headers = { Authorization: `Bearer ${apiKey}` };
            return { verify: headers, settle: headers, supported: headers };
          }
        : undefined,
    });
  }
  return new LocalFacilitatorClient(settings);
}

/** In-process facilitator: same verify/settle code the hosted ones run, with our own signer paying fees. */
export class LocalFacilitatorClient implements FacilitatorClient {
  readonly address: string;
  private readonly facilitator: x402Facilitator;

  constructor(settings: { secretKey: string; network?: StellarNetwork; rpcUrl?: string }) {
    const network = settings.network ?? DEFAULT_NETWORK;
    const signer = createEd25519Signer(settings.secretKey, network);
    this.address = signer.address;
    const rpcUrl = settings.rpcUrl ?? networkInfo(network).rpcUrl;
    this.facilitator = new x402Facilitator().register(
      network,
      new FacilitatorScheme([signer], { rpcConfig: rpcUrl ? { url: rpcUrl } : undefined }),
    );
  }

  verify(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.facilitator.verify(payload, requirements);
  }

  settle(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.facilitator.settle(payload, requirements);
  }

  async getSupported(): Promise<SupportedResponse> {
    // x402Facilitator types `network` as a plain string; the registered networks are CAIP-2 ids.
    return this.facilitator.getSupported() as SupportedResponse;
  }
}

/** Reads FACILITATOR_URL / FACILITATOR_API_KEY or FACILITATOR_SECRET_KEY. */
export function facilitatorSettingsFromEnv(env: NodeJS.ProcessEnv = process.env): FacilitatorSettings {
  const network = (env.STELLAR_NETWORK as StellarNetwork | undefined) ?? DEFAULT_NETWORK;
  if (env.FACILITATOR_SECRET_KEY) {
    return { kind: "local", secretKey: env.FACILITATOR_SECRET_KEY, network, rpcUrl: env.STELLAR_RPC_URL };
  }
  const url =
    env.FACILITATOR_URL ??
    (network === DEFAULT_NETWORK ? OPENZEPPELIN_TESTNET_FACILITATOR : OPENZEPPELIN_PUBNET_FACILITATOR);
  return { kind: "http", url, apiKey: env.FACILITATOR_API_KEY };
}
