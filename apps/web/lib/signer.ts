"use client";

// The wallet behind every in-browser payment: Freighter, or a test signer for local Playwright runs.

export interface AuthEntrySigner {
  address: string;
  signAuthEntry(
    preimageXdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ): Promise<{ signedAuthEntry: string; signerAddress?: string }>;
}

interface E2ESigner {
  address: string;
  networkPassphrase: string;
  sign(preimageXdr: string, opts?: { networkPassphrase?: string; address?: string }): Promise<{ signedAuthEntry: string; signerAddress?: string }>;
}

/**
 * Only a build with NEXT_PUBLIC_E2E_SIGNER=true reads window.__toolportE2E. Next inlines the flag,
 * so in every other build this is `false` and the test-signer branch is dead code. Never set it
 * for a deployed build: any script on the page could then sign for the wallet.
 */
function e2eSigner(): E2ESigner | null {
  if (process.env.NEXT_PUBLIC_E2E_SIGNER !== "true") return null;
  return (window as unknown as { __toolportE2E?: E2ESigner }).__toolportE2E ?? null;
}

export async function connectWallet(): Promise<{ address: string; networkPassphrase: string }> {
  const test = e2eSigner();
  if (test) return { address: test.address, networkPassphrase: test.networkPassphrase };
  const freighter = await import("@stellar/freighter-api");
  if (!(await freighter.isConnected()).isConnected) throw new Error("Freighter is not installed. Get it at freighter.app");
  const access = await freighter.requestAccess();
  if (access.error) throw new Error(access.error.message ?? "Freighter access denied");
  const details = await freighter.getNetworkDetails();
  return { address: access.address, networkPassphrase: details.networkPassphrase };
}

/**
 * Freighter's signAuthEntry signs the hash of the auth-entry preimage and hands back the raw signature
 * (https://developers.stellar.org/docs/build/guides/freighter/sign-auth-entries), sometimes as a Buffer
 * serialized to { type: "Buffer", data }. stellar-sdk's signAuthEntries wants that signature as base64.
 */
function signatureToBase64(signed: unknown): string {
  let bytes: Uint8Array;
  if (typeof signed === "string") return signed;
  if (signed instanceof Uint8Array) bytes = signed;
  else if (signed && typeof signed === "object" && Array.isArray((signed as { data?: unknown }).data)) {
    bytes = Uint8Array.from((signed as { data: number[] }).data);
  } else throw new Error("Freighter returned an unexpected signature format");
  if (bytes.length !== 64) throw new Error(`Freighter returned ${bytes.length} bytes, expected a 64-byte ed25519 signature`);
  return btoa(String.fromCharCode(...bytes));
}

/** An x402 Stellar signer: it signs the Soroban auth entry for the USDC transfer. */
export async function getSigner(address: string): Promise<AuthEntrySigner> {
  const test = e2eSigner();
  if (test) return { address, signAuthEntry: (preimageXdr, opts) => test.sign(preimageXdr, { ...opts, address }) };
  const freighter = await import("@stellar/freighter-api");
  return {
    address,
    signAuthEntry: async (preimageXdr, opts) => {
      const signed = await freighter.signAuthEntry(preimageXdr, { networkPassphrase: opts?.networkPassphrase, address });
      if (signed.error || !signed.signedAuthEntry) throw new Error(signed.error?.message ?? "Signature rejected in Freighter");
      return { signedAuthEntry: signatureToBase64(signed.signedAuthEntry), signerAddress: signed.signerAddress };
    },
  };
}
