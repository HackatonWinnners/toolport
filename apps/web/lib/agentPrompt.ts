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
    "2. From that checkout: claude plugin marketplace add ./ && claude plugin install toolport@toolport",
    `   (from GitHub instead: claude plugin marketplace add ${MARKETPLACE})`,
    ...(customGateway ? [`3. Set the plugin option gateway_url to ${GATEWAY_URL}: claude plugin configure toolport`] : []),
    `${customGateway ? 4 : 3}. Ask me to run /reload-plugins, then /toolport:setup. It checks the CLI, offers to create a funded testnet wallet at ~/.stellarpay/wallet.json and confirms the MCP server.`,
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
    "- MPP Router APIs are on Stellar mainnet: real USDC, a separate router run with its own wallet. Set that up only if I ask.",
    "",
    'Verify: call search_tools with "dex best path", then get_budget. Then tell me the wallet address, its XLM and USDC balances (toolport wallet show) and the caps in force.',
  ].join("\n");
}
