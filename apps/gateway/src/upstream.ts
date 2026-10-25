import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent } from "undici";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface UpstreamTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Price the upstream already advertises (e.g. a server built with @stellarpay/mcp) */
  advertisedUnits?: string;
}

/** Connect to an upstream MCP server and list its tools. */
export async function inspectUpstream(url: string): Promise<{ name?: string; tools: UpstreamTool[] }> {
  const client = new Client({ name: "stellarpay-gateway", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url), { fetch: upstreamFetch });
  await client.connect(transport);
  try {
    const tools: UpstreamTool[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined);
      for (const tool of page.tools) {
        const price = (tool._meta as any)?.["stellarpay/price"]?.amount;
        tools.push({
          name: tool.name,
          description: tool.description ?? "",
          inputSchema: tool.inputSchema as Record<string, unknown>,
          advertisedUnits: typeof price === "string" ? price : undefined,
        });
      }
      cursor = page.nextCursor;
    } while (cursor);
    return { name: client.getServerVersion()?.name, tools };
  } finally {
    await client.close();
  }
}

// Loopback, private, link-local (incl. cloud metadata), CGNAT and other non-public ranges.
const privateRanges = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) privateRanges.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) {
  privateRanges.addSubnet(net, prefix, "ipv6");
}

function isPrivateAddress(address: string): boolean {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return isPrivateAddress(mapped);
  return privateRanges.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

/**
 * Refuse upstream URLs that resolve to loopback/private networks, so a registered "MCP server"
 * can't point the gateway at its own host, internal services or cloud metadata.
 */
export async function assertPublicUpstream(url: string): Promise<void> {
  const { protocol, hostname } = new URL(url);
  if (protocol !== "http:" && protocol !== "https:") throw new Error("Upstream must be http(s)");
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.some(isPrivateAddress)) throw new Error("Upstream resolves to a private or loopback address");
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** dns.lookup that fails when any address is private, so the check holds at connect time. */
function publicOnlyLookup(hostname: string, options: LookupOptions, callback: LookupCallback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error(`Upstream ${hostname} resolves to a private or loopback address`), { code: "EPRIVATE" }), []);
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

let dispatcher: Agent | undefined;

/**
 * Re-check every upstream connection's resolved address, not just the one seen at registration:
 * otherwise a DNS record that flips to a private address after the check (rebinding) reaches the host's network.
 */
export function guardUpstreamConnections() {
  dispatcher = new Agent({ connect: { lookup: publicOnlyLookup } });
}

/**
 * Fetch for upstream MCP servers. Redirects are refused: a registered public server could
 * otherwise bounce the gateway to internal addresses that were never checked.
 */
export function upstreamFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, redirect: "error", ...(dispatcher && { dispatcher }) } as RequestInit);
}
