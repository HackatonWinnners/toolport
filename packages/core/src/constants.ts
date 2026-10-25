import {
  DEFAULT_PUBNET_HORIZON_URL,
  DEFAULT_TESTNET_HORIZON_URL,
  DEFAULT_TESTNET_RPC_URL,
  STELLAR_PUBNET_CAIP2,
  STELLAR_TESTNET_CAIP2,
  USDC_PUBNET_ADDRESS,
  USDC_TESTNET_ADDRESS,
} from "@x402/stellar";

export type StellarNetwork = typeof STELLAR_TESTNET_CAIP2 | typeof STELLAR_PUBNET_CAIP2;

export interface NetworkInfo {
  network: StellarNetwork;
  horizonUrl: string;
  rpcUrl?: string;
  /** USDC SEP-41 contract (the asset in payment requirements) */
  usdcContract: string;
  /** Classic USDC issuer, needed for trustlines */
  usdcIssuer: string;
  explorerUrl: string;
}

export const NETWORKS: Record<StellarNetwork, NetworkInfo> = {
  [STELLAR_TESTNET_CAIP2]: {
    network: STELLAR_TESTNET_CAIP2,
    horizonUrl: DEFAULT_TESTNET_HORIZON_URL,
    rpcUrl: DEFAULT_TESTNET_RPC_URL,
    usdcContract: USDC_TESTNET_ADDRESS,
    usdcIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    explorerUrl: "https://stellar.expert/explorer/testnet",
  },
  [STELLAR_PUBNET_CAIP2]: {
    network: STELLAR_PUBNET_CAIP2,
    horizonUrl: DEFAULT_PUBNET_HORIZON_URL,
    // Mainnet has no default public RPC; callers must pass STELLAR_RPC_URL.
    rpcUrl: undefined,
    usdcContract: USDC_PUBNET_ADDRESS,
    usdcIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    explorerUrl: "https://stellar.expert/explorer/public",
  },
};

export const DEFAULT_NETWORK: StellarNetwork = STELLAR_TESTNET_CAIP2;

export function isStellarNetworkId(value: string): value is StellarNetwork {
  return value in NETWORKS;
}

export function networkInfo(network: string = DEFAULT_NETWORK): NetworkInfo {
  if (!isStellarNetworkId(network)) {
    throw new Error(`Unsupported network "${network}". Use ${Object.keys(NETWORKS).join(" or ")}.`);
  }
  return NETWORKS[network];
}

export function explorerTxUrl(txHash: string, network: string = DEFAULT_NETWORK): string {
  return `${networkInfo(network).explorerUrl}/tx/${txHash}`;
}

export function explorerAccountUrl(address: string, network: string = DEFAULT_NETWORK): string {
  return `${networkInfo(network).explorerUrl}/account/${address}`;
}

/** x402 MCP transport keys (specs/transports-v2/mcp.md) */
export const PAYMENT_META_KEY = "x402/payment";
export const PAYMENT_RESPONSE_META_KEY = "x402/payment-response";
/** StellarPay's own keys, added to tools/list so agents can see prices before calling */
export const PRICE_META_KEY = "stellarpay/price";
