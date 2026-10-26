"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MppCatalog } from "@/components/catalog/MppCatalog";
import { Code, ErrorNote, UrlRow } from "@/components/ui";
import { api, claudeDesktopConfig, short, usd, type Server } from "@/lib/api";
import { CatalogSkeleton } from "@/components/brand/Skeleton";

export default function CatalogPage() {
  const [servers, setServers] = useState<Server[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<{ servers: Server[] }>("/api/servers")
      .then((r) => setServers(r.servers))
      .catch((e) => setError(`Gateway unreachable: ${e.message}`));
  }, []);

  const q = query.trim().toLowerCase();
  const visible = (servers ?? []).filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tools.some((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl space-y-3">
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em] text-fg">
            Tools your agent can pay for.
          </h1>
          <p className="text-[15px] leading-relaxed text-fg-soft">
            Every server here charges per tool call in USDC on Stellar via x402. Your agent sees the price before it
            pays, signs one auth entry, and the call settles in about 5 seconds. No API keys, no subscriptions.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-medium text-fg transition hover:bg-raised"
        >
          List your server
        </Link>
      </section>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search servers, tools and APIs"
        aria-label="Search servers and tools"
        className="w-full rounded-[10px] border border-line-strong bg-panel px-4 py-2.5 text-sm text-fg placeholder:text-faint focus:border-good focus:outline-none"
      />

      <ErrorNote message={error} />
      {servers === null && !error && <CatalogSkeleton />}
      {servers?.length === 0 && (
        <p className="text-muted">
          No listed servers yet.{" "}
          <Link href="/dashboard" className="text-accent hover:underline">
            Be the first.
          </Link>
        </p>
      )}
      {servers && servers.length > 0 && visible.length === 0 && (
        <p className="text-muted">Nothing matches “{query}”.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((server) => (
          <article
            key={server.id}
            data-testid="catalog-server"
            className="flex min-w-0 flex-col gap-4 rounded-[18px] border border-line bg-panel p-5"
          >
            <header className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-fg">{server.name}</h2>
                <span className="font-mono text-xs text-muted" title={server.payTo}>
                  pays {short(server.payTo)}
                </span>
              </div>
              {server.description && <p className="text-sm leading-relaxed text-fg-soft">{server.description}</p>}
            </header>

            <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
              {server.tools
                .filter((t) => t.enabled)
                .map((tool) => (
                  <li key={tool.name} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="font-mono text-sm font-medium text-fg">{tool.name}</div>
                      {tool.description && (
                        <div className="text-xs leading-relaxed text-fg-soft">{tool.description}</div>
                      )}
                      <Link
                        href="/#connect"
                        className="inline-block text-xs text-accent hover:underline"
                      >
                        Use it from your agent →
                      </Link>
                    </div>
                    <span
                      className={`shrink-0 text-lg font-semibold tracking-tight ${
                        Number(tool.priceUsd) === 0 ? "text-muted" : "text-fg"
                      }`}
                    >
                      {Number(tool.priceUsd) === 0 ? "free" : usd(tool.priceUsd)}
                    </span>
                  </li>
                ))}
            </ul>

            <UrlRow url={server.mcpUrl} />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted hover:text-fg">Add to Claude Desktop</summary>
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted">
                  Run <code className="font-mono text-fg-soft">toolport wallet create --usdc 5</code> once, then
                  add this to claude_desktop_config.json:
                </p>
                <Code>{claudeDesktopConfig([server.mcpUrl])}</Code>
              </div>
            </details>
          </article>
        ))}
      </div>

      <MppCatalog query={query} />
    </div>
  );
}
