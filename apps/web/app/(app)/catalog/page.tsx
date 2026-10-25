"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Code, ErrorNote, PriceTag, UrlRow } from "@/components/ui";
import { api, claudeDesktopConfig, short, type Server } from "@/lib/api";

export default function RegistryPage() {
  const [servers, setServers] = useState<Server[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<{ servers: Server[] }>("/api/servers")
      .then((r) => setServers(r.servers))
      .catch((e) => setError(`Gateway unreachable: ${e.message}`));
  }, []);

  const q = query.toLowerCase();
  const visible = (servers ?? []).filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tools.some((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Catalog: tools your agent can pay for</h1>
        <p className="max-w-2xl text-muted">
          Every server here charges per tool call in USDC on Stellar via x402. Agents sign a Soroban auth entry,
          the facilitator pays the fee, and the call settles in about 5 seconds. No API keys, no subscriptions.
        </p>
        <div className="flex gap-3 pt-1 text-sm">
          <Link href="/dashboard" className="text-accent hover:underline">Monetize your MCP server →</Link>
        </div>
      </section>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search servers and tools"
        className="w-full rounded-lg border border-line bg-panel px-4 py-2.5 text-sm"
      />

      <ErrorNote message={error} />
      {servers === null && !error && <p className="text-muted">Loading…</p>}
      {servers?.length === 0 && <p className="text-muted">No listed servers yet. Be the first from the dashboard.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((server) => (
          <Card key={server.id} className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{server.name}</h2>
                <span className="font-mono text-xs text-muted">pays {short(server.payTo)}</span>
              </div>
              {server.description && <p className="mt-1 text-sm text-muted">{server.description}</p>}
            </div>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {server.tools.filter((t) => t.enabled).map((tool) => (
                <li key={tool.name} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-mono text-sm">{tool.name}</div>
                    <div className="truncate text-xs text-muted">{tool.description}</div>
                  </div>
                  <PriceTag usd={tool.priceUsd} />
                </li>
              ))}
            </ul>
            <UrlRow url={server.mcpUrl} />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted hover:text-white">Add to Claude Desktop</summary>
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted">
                  Run <code className="font-mono">npm run cli -- wallet create --usdc 5</code> once, then add this to
                  claude_desktop_config.json:
                </p>
                <Code>{claudeDesktopConfig([server.mcpUrl])}</Code>
              </div>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}
