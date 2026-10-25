import { Asset, BASE_FEE, Horizon, Keypair, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { getNetworkPassphrase } from "@x402/stellar";
import { DEFAULT_NETWORK, networkInfo, type StellarNetwork } from "./constants.js";

export interface AccountStatus {
  address: string;
  exists: boolean;
  xlm: string;
  usdc: string | null;
  hasUsdcTrustline: boolean;
}

export function usdcAsset(network: StellarNetwork = DEFAULT_NETWORK): Asset {
  return new Asset("USDC", networkInfo(network).usdcIssuer);
}

function horizon(network: StellarNetwork) {
  return new Horizon.Server(networkInfo(network).horizonUrl);
}

export async function getAccountStatus(
  address: string,
  network: StellarNetwork = DEFAULT_NETWORK,
): Promise<AccountStatus> {
  // Contract accounts (C...) hold SEP-41 balances, not trustlines; they can always receive.
  if (address.startsWith("C")) {
    return { address, exists: true, xlm: "0", usdc: null, hasUsdcTrustline: true };
  }
  try {
    const account = await horizon(network).loadAccount(address);
    const issuer = networkInfo(network).usdcIssuer;
    const native = account.balances.find((b) => b.asset_type === "native");
    const usdc = account.balances.find(
      (b) => "asset_code" in b && b.asset_code === "USDC" && "asset_issuer" in b && b.asset_issuer === issuer,
    );
    return {
      address,
      exists: true,
      xlm: native?.balance ?? "0",
      usdc: usdc?.balance ?? null,
      hasUsdcTrustline: Boolean(usdc),
    };
  } catch (error) {
    if (error instanceof Error && /not ?found|404/i.test(error.message + String((error as any)?.response?.status))) {
      return { address, exists: false, xlm: "0", usdc: null, hasUsdcTrustline: false };
    }
    throw error;
  }
}

/** Testnet only: fund a new account with 10,000 XLM. */
export async function friendbot(address: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
  if (!res.ok && res.status !== 400) {
    throw new Error(`Friendbot failed (${res.status}): ${await res.text()}`);
  }
}

async function submit(
  secretKey: string,
  network: StellarNetwork,
  build: (tx: TransactionBuilder, source: string) => TransactionBuilder,
): Promise<string> {
  const keypair = Keypair.fromSecret(secretKey);
  const server = horizon(network);
  const account = await server.loadAccount(keypair.publicKey());
  const tx = build(
    new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: getNetworkPassphrase(network) }),
    keypair.publicKey(),
  )
    .setTimeout(60)
    .build();
  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

export function addUsdcTrustline(secretKey: string, network: StellarNetwork = DEFAULT_NETWORK) {
  return submit(secretKey, network, (tx) => tx.addOperation(Operation.changeTrust({ asset: usdcAsset(network) })));
}

/**
 * Buy exactly `usdcAmount` USDC with XLM on the Stellar DEX (path payment to self).
 * Handy on testnet when the Circle faucet is not an option.
 */
export async function buyUsdcWithXlm(
  secretKey: string,
  usdcAmount: string,
  network: StellarNetwork = DEFAULT_NETWORK,
  maxXlm = "1000",
) {
  const address = Keypair.fromSecret(secretKey).publicKey();
  return submit(secretKey, network, (tx) =>
    tx.addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax: maxXlm,
        destination: address,
        destAsset: usdcAsset(network),
        destAmount: usdcAmount,
        path: [],
      }),
    ),
  );
}

export function sendUsdc(
  secretKey: string,
  destination: string,
  amount: string,
  network: StellarNetwork = DEFAULT_NETWORK,
) {
  return submit(secretKey, network, (tx) =>
    tx.addOperation(Operation.payment({ destination, asset: usdcAsset(network), amount })),
  );
}

/** Keypair + Friendbot + USDC trustline: a wallet ready to receive or spend testnet USDC. */
export async function createTestnetWallet(): Promise<{ publicKey: string; secretKey: string }> {
  const keypair = Keypair.random();
  await friendbot(keypair.publicKey());
  await addUsdcTrustline(keypair.secret(), DEFAULT_NETWORK);
  return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
}
