// Real testnet runs, from README.md "Proven on testnet" and docs/verification/router-testnet.json.
// Every hash is the full 64-hex transaction id; links are built with txUrl().

import type { DotStatus } from "@/components/brand/StatusDot";

export interface ProofRow {
  status: "Settled" | "Refused" | "Stored";
  dot: DotStatus | "stored";
  amount: string;
  tool: string;
  mono?: boolean;
  source: string;
  what: string;
  tx?: string;
  note?: string;
}

export const PROOF: ProofRow[] = [
  {
    status: "Settled",
    dot: "settled",
    amount: "$0.001",
    tool: "Current weather",
    source: "Rail402",
    what: "Lisbon: 21°, sunny",
    tx: "9d1d9665682a7b7d2866ff77b6083b735df2cc473fc737dc61bfe389380886be",
  },
  {
    status: "Settled",
    dot: "settled",
    amount: "$0.02",
    tool: "dex_best_path",
    mono: true,
    source: "Stellar Oracle",
    what: "100 XLM → 87.46 USDC",
    tx: "b3168b851ff33fc7cd7f64d1ef336bafa2187c64c5747cf39bcb99bc5e6efb76",
  },
  {
    status: "Settled",
    dot: "settled",
    amount: "$0.02",
    tool: "dex_best_path",
    mono: true,
    source: "Toolport registry",
    what: "Found by the router, verified on-chain",
    tx: "c31160c7cc5a9191eb63c984b9876c2f5d2e87f6bfe5fc8de0e30432cd364d77",
  },
  {
    status: "Settled",
    dot: "settled",
    amount: "$0.01",
    tool: "account_summary",
    mono: true,
    source: "SDK server",
    what: "Balances and recent operations",
    tx: "d8cbed10adb68f2cd3a9c33182310f111865bb987cf1315ae924fabbc33d236e",
  },
  {
    status: "Refused",
    dot: "refused",
    amount: "$0.02",
    tool: "A quote over the cap",
    source: "dex_best_path",
    what: "Over the call's $0.001 cap, caught before signing",
    note: "no transaction",
  },
  {
    status: "Stored",
    dot: "stored",
    amount: "$0",
    tool: "dex_best_path",
    mono: true,
    source: "router",
    what: "Same request again, stored result returned",
    note: "not paid twice",
  },
];

/** First 8 and last 6 hex characters, as on the board. */
export const shortHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`;
