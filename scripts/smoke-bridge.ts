/**
 * Drive `stellarpay connect` the way Claude Desktop does (stdio), list tools and make one call.
 *   npx tsx scripts/smoke-bridge.ts <paid-mcp-url> <tool> '<json-args>' [--max-per-call 0.05]
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const [url, tool, args = "{}", ...extra] = process.argv.slice(2);
if (!url || !tool) {
  console.error("usage: tsx scripts/smoke-bridge.ts <url> <tool> [json-args] [bridge flags]");
  process.exit(1);
}
const bin = fileURLToPath(new URL("../packages/cli/bin/stellarpay.js", import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [bin, "connect", "--urls", url, ...extra],
  env: process.env as Record<string, string>,
  stderr: "inherit",
});
const client = new Client({ name: "smoke", version: "0" });
await client.connect(transport);
const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));
const result = await client.callTool({ name: tool, arguments: JSON.parse(args) });
for (const item of result.content as any[]) console.log(item.text ?? item);
await client.close();
