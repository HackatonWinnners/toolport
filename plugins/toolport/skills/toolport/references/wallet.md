# Toolport wallet, budget and holds

Testnet only. The CLI reads the network from the shell, and a shell with `STELLAR_NETWORK=stellar:pubnet` makes `wallet buy-usdc` and `call` spend real funds. Run every command below with the testnet line in front, as written:

```bash
STELLAR_NETWORK=stellar:testnet toolport wallet show
```

## Where the secret comes from

The router and CLI take the first of:

1. `--secret S...` (visible in the process list; avoid it).
2. `STELLAR_SECRET_KEY`, including one inherited from the shell: when it is set, it wins over the wallet file.
3. The wallet file: `STELLARPAY_WALLET`, default `~/.stellarpay/wallet.json`, mode 600.

The budget database `agent.db` sits next to the wallet file. In the Claude Code plugin, the `wallet_file` option sets the wallet path and the `stellar_secret_key` option (secure storage) overrides it.

The secret stays where it is stored: read addresses with `STELLAR_NETWORK=stellar:testnet toolport wallet show`, which prints the public key and balances only. Keep the secret out of chat, command lines, files you write and logs.

## Create and fund

- `STELLAR_NETWORK=stellar:testnet toolport wallet create --usdc 5`: new keypair, Friendbot XLM, USDC trustline, then buys 5 USDC with XLM on the testnet DEX. Done when it prints `Saved to <path> (mode 600)`. It refuses to replace an existing wallet; ask the user before setting `STELLARPAY_WALLET_OVERWRITE=1`, since the old wallet's funds become unreachable without its file.
- `STELLAR_NETWORK=stellar:testnet toolport wallet show`: `Address`, `XLM`, `USDC` (or `(no trustline)` / `(account not funded)`).
- `STELLAR_NETWORK=stellar:testnet toolport wallet buy-usdc <amount>`: more USDC from XLM; adds the trustline if missing.
- Circle faucet, Stellar testnet: `https://faucet.circle.com`.

A payment re-challenged with an `invalidReason` such as insufficient balance or a missing trustline is fixed here: `wallet show`, then `wallet buy-usdc` or the faucet.

## Budget and holds

`STELLAR_NETWORK=stellar:testnet toolport budget --session <name>` prints cap, per-call cap, spent, pending, remaining and each open **hold**. The Claude Code plugin uses session `claude-code`; the CLI default is `default`. `get_budget` shows the same numbers for the router's session. `toolport budget` leaves the stored limits as they are; `--budget` and `--max-per-call` rewrite the stored limits of that session (a lower value also binds a router already running on it), so pass them only when the user asks for new limits.

A **hold** is an amount reserved for a payment whose outcome is not known yet. It counts as pending and stays until resolved; there is no expiry.

1. `STELLAR_NETWORK=stellar:testnet toolport budget --session <name> --reconcile`: verifies each hold that has a transaction on-chain and settles it. Run it first, and again later if the network was slow.
2. `STELLAR_NETWORK=stellar:testnet toolport budget --session <name> --release <id>`: frees a hold. Use it only after the user has confirmed, from the wallet's on-chain history (`Explorer` link in `wallet show`), that this payment never left the wallet.

The budget belongs to the session name. A hold or an exhausted budget is resolved by reconcile, release or the user raising the budget; the session name stays the same.
