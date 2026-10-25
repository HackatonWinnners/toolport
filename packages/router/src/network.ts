import { lookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Agent } from "undici";
const privateRanges = new BlockList();
for (const [net, bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.168.0.0",16],["198.18.0.0",15],["224.0.0.0",3]] as const) privateRanges.addSubnet(net,bits,"ipv4");
for (const [net,bits] of [["::",127],["fc00::",7],["fe80::",10],["ff00::",8]] as const) privateRanges.addSubnet(net,bits,"ipv6");
export function isPrivate(address: string): boolean {
  const normalized = address.toLowerCase();
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mapped) return isPrivate(mapped);
  const hex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) { const n = BigInt("0x"+hex[1]) * 65536n + BigInt("0x"+hex[2]); return isPrivate([24n,16n,8n,0n].map((s) => Number(n >> s & 255n)).join(".")); }
  return privateRanges.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}
/** Guard each catalog/provider request. Redirects are rejected, including paid-request redirects. */
export function providerFetch(allowLoopback = false): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (!["http:","https:"].includes(url.protocol) || url.username || url.password) throw new Error("Provider URL must be HTTP(S) without credentials");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [host] : (await lookup(host, { all:true })).map((a) => a.address);
    if (!addresses.length) throw new Error("Provider hostname did not resolve");
    for (const address of addresses) {
      const loopback = address === "::1" || /^127\./.test(address);
      if (isPrivate(address) && !(allowLoopback && loopback)) throw new Error("Provider resolves to a private network");
    }
    if (!(allowLoopback && addresses.every((a) => a === "::1" || /^127\./.test(a))) && (url.protocol !== "https:" || (url.port && url.port !== "443"))) throw new Error("Remote providers must use HTTPS on port 443");
    // Pin the validated addresses for the actual socket lookup; a second DNS resolution
    // must not turn a public hostname into a private address (DNS rebinding).
    const pinned: LookupFunction = (_host, options, callback) => {
      callback(null, options.all ? addresses.map((address) => ({ address, family:isIP(address) })) : addresses[0], isIP(addresses[0]));
    };
    const dispatcher = new Agent({ connect:{ lookup:pinned } });
    try {
      const response = await fetch(input, { ...init, dispatcher, redirect:"error", signal:init?.signal ?? AbortSignal.timeout(45_000) } as RequestInit);
      void dispatcher.close(); // graceful: outstanding response body is allowed to drain
      return response;
    } catch (error) { await dispatcher.destroy(); throw error; }
  };
}
