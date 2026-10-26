import { existsSync } from "node:fs";
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

async function savedSecret() {
  const wallet = await loadWallet();
  if (typeof wallet?.secretKey === "string" && wallet.secretKey) return wallet.secretKey;
  if (wallet || existsSync(walletPath())) throw new Error(`Cannot read the wallet file ${walletPath()}: expected JSON with a secretKey`);
  return null;
}

/** --secret, then STELLAR_SECRET_KEY, then the saved wallet; null when none is configured. */
export async function findSecret(flag?: string): Promise<string | null> {
  const secret = flag ?? process.env.STELLAR_SECRET_KEY ?? (await savedSecret());
  if (!secret) return null;
  try {
    Keypair.fromSecret(secret);
  } catch {
    throw new Error(`Invalid Stellar secret key (from ${flag ? "--secret" : process.env.STELLAR_SECRET_KEY ? "STELLAR_SECRET_KEY" : walletPath()})`);
  }
  return secret;
}

export async function resolveSecret(flag?: string): Promise<string> {
  const secret = await findSecret(flag);
  if (!secret) {
    throw new Error("No wallet. Run `toolport wallet create`, or pass --secret / STELLAR_SECRET_KEY.");
  }
  return secret;
}
