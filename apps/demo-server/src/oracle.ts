import { Asset, Horizon } from "@stellar/stellar-sdk";
import { networkInfo, type StellarNetwork } from "@stellarpay/core";

/** "XLM", "USDC" (network's USDC) or "CODE:ISSUER" */
export function parseAsset(input: string, network: StellarNetwork): Asset {
  const value = input.trim();
  if (/^(xlm|native)$/i.test(value)) return Asset.native();
  if (/^usdc$/i.test(value)) return new Asset("USDC", networkInfo(network).usdcIssuer);
  const [code, issuer] = value.split(":");
  if (!code || !issuer) throw new Error(`Asset "${input}" must be XLM, USDC or CODE:ISSUER`);
  return new Asset(code, issuer);
}

const label = (asset: { asset_type: string; asset_code?: string }) =>
  asset.asset_type === "native" ? "XLM" : (asset.asset_code ?? "?");

export class StellarOracle {
  private horizon: Horizon.Server;

  constructor(private readonly network: StellarNetwork) {
    this.horizon = new Horizon.Server(networkInfo(network).horizonUrl);
  }

  async accountSummary(address: string) {
    const account = await this.horizon.loadAccount(address);
    const ops = await this.horizon.operations().forAccount(address).order("desc").limit(5).call();
    return {
      address,
      network: this.network,
      sequence: account.sequence,
      subentries: account.subentry_count,
      balances: account.balances.map((b) => ({
        asset: b.asset_type === "native" ? "XLM" : `${(b as any).asset_code}:${(b as any).asset_issuer}`,
        balance: b.balance,
      })),
      recentOperations: ops.records.map((op) => ({ type: op.type, createdAt: op.created_at, tx: op.transaction_hash })),
    };
  }

  /** Best strict-send paths across the Stellar DEX and AMMs, as Horizon's path finder sees them. */
  async bestPath(from: string, to: string, amount: string) {
    const source = parseAsset(from, this.network);
    const dest = parseAsset(to, this.network);
    const result = await this.horizon.strictSendPaths(source, amount, [dest]).limit(5).call();
    const paths = result.records
      .map((p) => ({
        receive: p.destination_amount,
        hops: [label({ asset_type: p.source_asset_type, asset_code: p.source_asset_code })]
          .concat(p.path.map((h) => label(h)))
          .concat(label({ asset_type: p.destination_asset_type, asset_code: p.destination_asset_code })),
      }))
      .sort((a, b) => Number(b.receive) - Number(a.receive));
    const best = paths[0];
    return {
      network: this.network,
      send: `${amount} ${label({ asset_type: source.isNative() ? "native" : "credit", asset_code: source.getCode() })}`,
      best: best ? { receive: best.receive, route: best.hops.join(" → "), rate: (Number(best.receive) / Number(amount)).toPrecision(6) } : null,
      alternatives: paths.slice(1),
      note: best ? undefined : "No path found; the order books may be empty for this pair on this network.",
    };
  }
}
