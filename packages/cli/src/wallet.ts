import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Keypair } from "@stellar/stellar-sdk";

export interface StoredWallet {
  publicKey: string;
  secretKey: string;
  network: string;
  createdAt: string;
}

export const walletPath = () => process.env.STELLARPAY_WALLET ?? join(homedir(), ".stellarpay", "wallet.json");

export async function loadWallet(): Promise<StoredWallet | null> {
  try {
    return JSON.parse(await readFile(walletPath(), "utf8"));
  } catch {
    return null;
  }
}

export async function saveWallet(wallet: StoredWallet) {
  const path = walletPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(wallet, null, 2), { mode: 0o600 });
  await chmod(path, 0o600);
  return path;
}

/** --secret, then STELLAR_SECRET_KEY, then the saved wallet. */
export async function resolveSecret(flag?: string): Promise<string> {
  const secret = flag ?? process.env.STELLAR_SECRET_KEY ?? (await loadWallet())?.secretKey;
  if (!secret) {
    throw new Error("No wallet. Run `stellarpay wallet create`, or pass --secret / STELLAR_SECRET_KEY.");
  }
  Keypair.fromSecret(secret); // validate
  return secret;
}
