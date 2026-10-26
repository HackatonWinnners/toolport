import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Keypair } from "@stellar/stellar-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const bin = fileURLToPath(new URL("../bin/stellarpay.js", import.meta.url));
const tool = {
  id: "dex",
  title: "DEX best path",
  description: "Best path on the testnet DEX",
  network: "stellar:testnet",
  transport: "http",
  method: "GET",
  url: "http://127.0.0.1:9/path",
  inputSchema: { type: "object" },
};
const NO_WALLET = "No wallet. Run `toolport wallet create` or /toolport:setup, then call again.";
const dirs: string[] = [];
const clients: Client[] = [];

const text = (result: any) => result.content[0].text as string;
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => (await client.callTool({ name, arguments: args })) as any;

async function startRouter(walletFile: (dir: string) => string, limits: string[] = ["--budget", "0.5", "--max-per-call", "0.02"]) {
  const dir = await mkdtemp(join(tmpdir(), "toolport-router-no-wallet-"));
  dirs.push(dir);
  const manifest = join(dir, "tools.json");
  await writeFile(manifest, JSON.stringify([tool]));
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  for (const key of ["STELLAR_SECRET_KEY", "STELLARPAY_BUDGET", "STELLARPAY_MAX_PER_CALL", "TOOLPORT_GATEWAY_URL", "STELLAR_RPC_URL"]) delete env[key];
  const wallet = walletFile(dir);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bin, "router", "--gateway", "", "--manifest", manifest, "--allow-local", ...limits],
    env: { ...env, STELLARPAY_WALLET: wallet, STELLAR_NETWORK: "stellar:testnet" },
    stderr: "pipe",
  });
  const output = { stderr: "" };
  transport.stderr?.on("data", (chunk) => { output.stderr += String(chunk); });
  const client = new Client({ name: "test", version: "1" });
  await client.connect(transport);
  clients.push(client);
  return { client, dir, wallet, output };
}

afterAll(async () => {
  for (const client of clients) await client.close();
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

describe("toolport router without a wallet", () => {
  let router: Awaited<ReturnType<typeof startRouter>>;
  beforeAll(async () => {
    router = await startRouter((dir) => join(dir, "missing", "wallet.json"));
  });

  it("serves MCP and the free tools before a wallet exists", async () => {
    const { client } = router;
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(["search_tools", "get_tool", "probe_tool", "invoke_tool", "get_run", "get_budget"]);
    const search = await call(client, "search_tools", { query: "dex best path" });
    expect(JSON.parse(text(search)).tools[0].id).toBe("manifest:dex");
    expect(JSON.parse(text(await call(client, "get_tool", { id: "manifest:dex" }))).title).toBe("DEX best path");
    const budget = JSON.parse(text(await call(client, "get_budget")));
    expect(budget).toMatchObject({ asset: "USDC", cap: "0.5", perCall: "0.02", spent: "0", pending: "0", remaining: "0.5", wallet: null });
  });

  it("refuses invoke_tool and get_run with a clear error and keeps running", async () => {
    const { client } = router;
    const result = await call(client, "invoke_tool", { id: "manifest:dex", args: {}, maxAmount: "0.01", idempotencyKey: "first" });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe(NO_WALLET);
    const run = await call(client, "get_run", { id: "00000000-0000-4000-8000-000000000000" });
    expect(run.isError).toBe(true);
    expect(text(run)).toBe(NO_WALLET);
    expect((await client.listTools()).tools.length).toBe(6);
  });

  it("picks up a wallet created after startup without a restart", async () => {
    const { client, dir, wallet, output } = router;
    const keypair = Keypair.random();
    await mkdir(join(dir, "missing"), { recursive: true });
    await writeFile(wallet, JSON.stringify({ publicKey: keypair.publicKey(), secretKey: keypair.secret(), network: "stellar:testnet", createdAt: new Date().toISOString() }));
    const result = await call(client, "invoke_tool", { id: "manifest:dex", args: {}, maxAmount: "0.01", idempotencyKey: "second" });
    expect(text(result)).not.toMatch(/No wallet/);
    const run = JSON.parse(text(result));
    expect(run.status).toBe("failed");
    expect(run.error.paid).toBe("none");
    expect(JSON.parse(text(await call(client, "get_run", { id: run.id }))).id).toBe(run.id);
    const replay = JSON.parse(text(await call(client, "invoke_tool", { id: "manifest:dex", args: {}, maxAmount: "0.01", idempotencyKey: "second" })));
    expect(replay).toMatchObject({ id: run.id, replayed: true });
    const budget = JSON.parse(text(await call(client, "get_budget")));
    expect(budget).toMatchObject({ cap: "0.5", perCall: "0.02", spent: "0", pending: "0", remaining: "0.5" });
    expect(budget).not.toHaveProperty("wallet");
    expect(output.stderr).not.toContain(keypair.secret());
  });
});

describe("toolport router with a broken configuration", () => {
  it("keeps serving with an invalid budget and reports it from the budget and paid tools", async () => {
    const { client } = await startRouter((dir) => join(dir, "wallet.json"), ["--budget=0", "--max-per-call", "0.02"]);
    expect(JSON.parse(text(await call(client, "search_tools", { query: "dex" }))).tools[0].id).toBe("manifest:dex");
    const budget = await call(client, "get_budget");
    expect(budget.isError).toBe(true);
    expect(text(budget)).toMatch(/Budget and per-call cap must be positive/);
  });

  it("keeps serving with a malformed wallet file and says so on a paid call", async () => {
    const { client, wallet, output } = await startRouter((dir) => join(dir, "wallet.json"));
    await writeFile(wallet, "{ not json");
    expect(JSON.parse(text(await call(client, "search_tools", { query: "dex" }))).tools[0].id).toBe("manifest:dex");
    const result = await call(client, "invoke_tool", { id: "manifest:dex", args: {}, maxAmount: "0.01", idempotencyKey: "broken" });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain(`Cannot read the wallet file ${wallet}`);
    const secret = "SNOTAVALIDSTELLARSECRETKEY";
    await writeFile(wallet, JSON.stringify({ publicKey: "G", secretKey: secret, network: "stellar:testnet" }));
    const invalid = await call(client, "invoke_tool", { id: "manifest:dex", args: {}, maxAmount: "0.01", idempotencyKey: "broken" });
    expect(invalid.isError).toBe(true);
    expect(text(invalid)).toMatch(/Invalid Stellar secret key/);
    expect(output.stderr).not.toContain(secret);
    expect(text(invalid)).not.toContain(secret);
    expect((await client.listTools()).tools.length).toBe(6);
  });
});
