import { GATEWAY_URL, REPO_URL, routerConfig } from "./api";

export const PLUGIN_DEFAULT_GATEWAY = "https://api.toolport.042067.xyz";
const REPO = REPO_URL ?? "https://github.com/HackatonWinnners/toolport";
const MARKETPLACE = REPO.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");

export function claudePluginCommands(): string {
  return [
    `git clone ${REPO} toolport && cd toolport`,
    "npm ci && npm link -w packages/cli",
    "claude plugin marketplace add ./",
    "claude plugin install toolport@toolport",
  ].join("\n");
}

export function agentPrompt(): string {
  const customGateway = GATEWAY_URL !== PLUGIN_DEFAULT_GATEWAY;
  return [
    "Set up Toolport for me. Toolport lets you find paid MCP tools, see the exact price before anything is signed, and pay per call in USDC on Stellar under caps I set. Its registry runs on Stellar testnet with test USDC, so no real money by default.",
    "",
    `Repo: ${REPO}`,
    `Registry gateway: ${GATEWAY_URL}`,
    "Needs Node 22+ and git.",
    "",
    "1. Get the CLI:",
    `   git clone ${REPO} toolport && cd toolport && npm ci && npm link -w packages/cli`,
    "   Check: toolport --help",
    "",
    "If you are Claude Code:",
    "2. Create the testnet wallet first. Skip if ~/.stellarpay/wallet.json already exists:",
    "   STELLAR_NETWORK=stellar:testnet toolport wallet create --usdc 5",
    "   Then show me the address and balances with toolport wallet show. Never print the secret.",
    "3. Install the plugin from that checkout: claude plugin marketplace add ./ && claude plugin install toolport@toolport",
    `   (from GitHub instead: claude plugin marketplace add ${MARKETPLACE})`,
    ...(customGateway ? [`4. Set the plugin option gateway_url to ${GATEWAY_URL}: claude plugin configure toolport`] : []),
    `${customGateway ? 5 : 4}. Ask me to run /reload-plugins. /toolport:setup is an optional check of the CLI, wallet and MCP server.`,
    `${customGateway ? 6 : 5}. Verify through the Toolport MCP tools: call search_tools with "dex best path", then get_budget. If the toolport MCP server shows as failed, ask me to reconnect it: /mcp, then plugin:toolport:toolport, then Reconnect.`,
    "",
    "Any other agent (Codex, Cursor, other MCP clients):",
    "2. Create a testnet wallet: STELLAR_NETWORK=stellar:testnet toolport wallet create --usdc 5",
    "3. Add this stdio MCP server (Claude Desktop / Cursor format; translate it for your client):",
    `   ${JSON.stringify(JSON.parse(routerConfig()))}`,
    "4. Copy plugins/toolport/skills/toolport/ (SKILL.md and references/) into your skills directory.",
    "",
    "Rules:",
    "- Ask me before the first paid call (invoke_tool). probe_tool shows the price without paying.",
    "- Never print, paste or log the wallet secret key. Refer to the wallet by its file path.",
    "- Keep the caps ($0.05 per call, $1 budget) unless I raise them myself.",
    "- For tasks that need live Stellar or market data, use Toolport's tools (search_tools, probe_tool, then invoke_tool after my yes) rather than free public APIs; that is what we are testing.",
    "- MPP Router APIs are on Stellar mainnet: real USDC, a separate router run with its own wallet. Set that up only if I ask.",
    "",
    'Finish (any agent): once search_tools with "dex best path" and get_budget both answer, tell me the wallet address, its XLM and USDC balances (toolport wallet show) and the caps in force.',
  ].join("\n");
}
