---
name: setup
description: Check the Toolport CLI and wallet, create a funded testnet wallet if missing, and confirm the toolport MCP server is connected.
disable-model-invocation: true
---

# Toolport setup

Run each command exactly as written; the launcher finds the Toolport CLI the same way the MCP server does and always runs it on Stellar testnet. The wallet secret never appears in output: the CLI prints addresses and balances only. Keep it out of chat and commands; the only way to enter a secret key is the plugin's `stellar_secret_key` option, which Claude Code stores in secure storage.

1. `node --version`. Done when it is v22 or later; otherwise ask the user to install Node 22+ and stop.
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/toolport.mjs" --help`. Done when it prints the Toolport usage. If it prints `error: Toolport CLI not found…`, give the user these options and stop:
   - in a toolport checkout: `npm ci && npm link -w packages/cli`;
   - or set the plugin option `cli_path` to `<checkout>/packages/cli/bin/stellarpay.js` (`claude plugin configure toolport`, or `/plugin`);
   - or start Claude Code from a shell with `TOOLPORT_CLI=<checkout>/packages/cli/bin/stellarpay.js` exported, then restart it.
3. `test -n "${STELLAR_SECRET_KEY:-}" && echo "STELLAR_SECRET_KEY is set"` (prints no value). If it reports the variable as set, tell the user: a `STELLAR_SECRET_KEY` inherited from their shell overrides the wallet file for these commands and for the MCP server, so the wallet shown next is that key's account; to use the wallet file instead, start Claude Code without it. Then `node "${CLAUDE_PLUGIN_ROOT}/scripts/toolport.mjs" wallet show`. If it prints a wallet, setup only confirms it: create nothing and go to step 4. If it reports `No wallet.`, ask the user whether to create a testnet wallet at `~/.stellarpay/wallet.json` funded with 5 test USDC. On yes, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/toolport.mjs" wallet create --usdc 5`; done when it prints `Saved to … (mode 600)`. If the user set the `wallet_file` option, run both commands with `STELLARPAY_WALLET=<that path>` in front.
4. Show the user the `Address`, `XLM` and `USDC` lines from `wallet show`. If USDC is `0`, offer `wallet buy-usdc 5` or `https://faucet.circle.com`.
5. Call the `get_budget` tool. The MCP server runs without a wallet and reads the wallet again on every paid call, so a wallet created in step 3 needs no restart. If the tool is missing or the server shows as failed, ask the user to reconnect it via `/mcp` → `plugin:toolport:toolport` → Reconnect, and wait until they have done it. Done when it returns `cap`, `perCall`, `spent`, `pending` and `remaining` without `wallet: null`; `wallet: null` means the server sees no wallet, so check the `wallet_file` option against the path from step 3.
6. Tell the user the caps in force (`perCall` and `cap` from step 5) and that `max_per_call`, `budget`, `session` and `gateway_url` change with `claude plugin configure toolport` or `/plugin`. Tell them these caps are the hard stop: the prompt before each paid `invoke_tool` call shows only in the default permission mode, not in `auto` or `bypassPermissions`. If they use those modes, suggest keeping the caps low or adding this to their settings themselves:

   ```json
   { "permissions": { "ask": ["mcp__plugin_toolport_toolport__invoke_tool"] } }
   ```
