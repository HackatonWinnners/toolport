import { DEFAULT_NETWORK, type StellarNetwork } from "@stellarpay/core";

export const HOSTED_GATEWAY_URL = "https://api.toolport.042067.xyz";

export function routerGatewayUrl(flag: string | undefined, envValue: string | undefined, network: StellarNetwork): string | undefined {
  return flag ?? (envValue || undefined) ?? (network === DEFAULT_NETWORK ? HOSTED_GATEWAY_URL : undefined);
}
