"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Code } from "@/components/ui";
import { ApiCardSkeleton, ApiGridSkeleton } from "@/components/brand/Skeleton";
import { MAINNET_MAX_PER_CALL, MAINNET_WALLET, api, mppRouterCommand, registryRouterCommand, usd, type Server } from "@/lib/api";

interface MppService {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  price: string;
  method: string;
  verified: boolean;
  docs?: string;
  icon?: string;
}

interface CatalogItem {
  key: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  price: string;
  badge: string;
  verified: boolean;
  icon?: string;
  link: { href: string; label: string; ariaLabel: string; external: boolean } | null;
  searchText: string;
}

const PAGE = 24;
const REGISTRY_TIMEOUT_MS = 8000;
const label = (category: string) => (category === "ai" ? "AI" : category === "mcp" ? "MCP" : category);
const listedPrices = (price: string) => [...price.matchAll(/\$\s*(\d*\.?\d+)/g)].map((m) => Number(m[1]));

export function ProviderIcon({ src, provider }: { src?: string; provider: string }) {
  const [broken, setBroken] = useState(false);
  const tile = "flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px]";
  if (!src || broken) {
    return (
      <span aria-hidden="true" data-testid="catalog-icon-fallback" className={`${tile} bg-raised text-[11px] font-semibold uppercase text-muted`}>
        {provider.trim().charAt(0) || "·"}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`${tile} bg-[#f4f1ea] p-0.5`}>
      <img
        src={src}
        alt=""
        width={16}
        height={16}
        loading="lazy"
        decoding="async"
        data-testid="catalog-icon"
        onError={() => setBroken(true)}
        className="h-4 w-4 object-contain"
      />
    </span>
  );
}

function priceRange(server: Server) {
  const prices = server.tools.filter((t) => t.enabled).map((t) => Number(t.priceUsd));
  if (prices.length === 0) return "no tools yet";
  const paid = prices.filter((p) => p > 0);
  if (paid.length === 0) return "free";
  const min = Math.min(...paid);
  const max = Math.max(...paid);
  const range = min === max ? `${usd(max)}/call` : `${usd(min)}–${usd(max)}/call`;
  return paid.length < prices.length ? `free + ${range}` : range;
}

function fromServer(server: Server): CatalogItem {
  const tools = server.tools.filter((t) => t.enabled);
  return {
    key: `registry:${server.id}`,
    name: server.name,
    provider: server.name,
    category: "mcp",
    description: server.description,
    price: priceRange(server),
    badge: "MCP",
    verified: false,
    link: {
      href: `/servers/${server.id}`,
      label: `${tools.length} ${tools.length === 1 ? "tool" : "tools"} →`,
      ariaLabel: `${server.name}: ${tools.length} ${tools.length === 1 ? "tool" : "tools"}`,
      external: false,
    },
    searchText: [server.name, server.description, "mcp registry", ...tools.flatMap((t) => [t.name, t.description])].join(" ").toLowerCase(),
  };
}

function fromMpp(s: MppService): CatalogItem {
  return {
    key: `mpp:${s.id}`,
    name: s.name,
    provider: s.provider,
    category: s.category,
    description: s.description,
    price: s.price,
    badge: s.method,
    verified: s.verified,
    icon: s.icon,
    link: s.docs ? { href: s.docs, label: "Docs ↗", ariaLabel: `${s.name} docs (opens in a new tab)`, external: true } : null,
    searchText: `${s.name} ${s.provider} ${s.description} ${s.category}`.toLowerCase(),
  };
}

export function Catalog({ query }: { query: string }) {
  const [registry, setRegistry] = useState<Server[] | null>(null);
  const [registryDown, setRegistryDown] = useState(false);
  const [mpp, setMpp] = useState<MppService[] | null>(null);
  const [mppDown, setMppDown] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    api<{ servers: Server[] }>("/api/servers", { signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) })
      .then((r) => setRegistry(r.servers))
      .catch(() => {
        setRegistry([]);
        setRegistryDown(true);
      });
    fetch("/catalog/mpprouter.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { services: MppService[] }) => setMpp(data.services))
      .catch(() => {
        setMpp([]);
        setMppDown(true);
      });
  }, []);

  useEffect(() => setShown(PAGE), [query, category]);

  const items = useMemo(
    () => [...(registry ?? []).filter((s) => s.listed).map(fromServer), ...(mpp ?? []).map(fromMpp)],
    [registry, mpp],
  );
  const serverCount = registry?.filter((s) => s.listed).length ?? 0;
  const overCap = useMemo(
    () => (mpp ?? []).filter((s) => listedPrices(s.price).some((p) => p > MAINNET_MAX_PER_CALL)).length,
    [mpp],
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const q = query.trim().toLowerCase();
  const visible = items.filter((item) => (!category || item.category === category) && (!q || item.searchText.includes(q)));
  const bothDown = registryDown && mppDown;
  const nothingYet = registry === null && mpp === null;
  const counts = [
    registry === null ? "loading the registry…" : `${serverCount} MCP ${serverCount === 1 ? "server" : "servers"}`,
    mpp === null ? "loading APIs…" : `${mpp.length} APIs`,
  ].join(" · ");

  return (
    <section aria-labelledby="catalog-h" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="catalog-h" className="text-sm font-normal text-fg-soft" data-testid="catalog-count">
          {counts}
        </h2>
      </div>

      {bothDown ? (
        <p data-testid="catalog-down" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-fg-soft">
          The catalog couldn&apos;t load: neither the Toolport registry nor the MPP Router list is reachable right now.
          Try again in a moment.
        </p>
      ) : (
        (registryDown || mppDown) && (
          <p data-testid="catalog-partial" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-fg-soft">
            {registryDown
              ? "The Toolport registry is unreachable right now, so its MCP servers are missing. MPP Router APIs are shown below."
              : "The MPP Router list didn't load. Toolport registry servers are shown below."}
          </p>
        )
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-fg">Give them to your agent</summary>
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted">
            The router searches, prices and pays under your caps. Each network is its own router run with its own wallet.
          </p>
          <p className="text-xs text-fg-soft">Toolport registry, Stellar testnet, test USDC:</p>
          <Code>{registryRouterCommand()}</Code>
          <p className="text-xs text-fg-soft">MPP Router APIs, Stellar mainnet, real USDC, with its own wallet:</p>
          <Code>{mppRouterCommand()}</Code>
          <p className="text-xs text-muted" data-testid="catalog-mainnet-wallet">
            <code className="break-all font-mono text-fg-soft">toolport wallet create</code> only makes testnet wallets (it uses
            Friendbot). For mainnet, save a funded key as{" "}
            <code className="break-all font-mono text-fg-soft">{'{"publicKey": "G…", "secretKey": "S…", "network": "stellar:pubnet"}'}</code>{" "}
            in <code className="break-all font-mono text-fg-soft">{MAINNET_WALLET}</code> (mode 600), or pass{" "}
            <code className="break-all font-mono text-fg-soft">STELLAR_SECRET_KEY</code> instead. Check it with{" "}
            <code className="break-all font-mono text-fg-soft">STELLARPAY_WALLET={MAINNET_WALLET} toolport wallet show --network stellar:pubnet</code>
            . The router keeps its spend records next to that file, apart from the testnet ones.
          </p>
          {overCap > 0 && (
            <p className="text-xs text-muted" data-testid="catalog-overcap">
              {overCap} APIs list a price above ${MAINNET_MAX_PER_CALL.toFixed(2)} per call and are refused under this cap. Raise
              --max-per-call to use them.
            </p>
          )}
        </div>
      </details>

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {[["all", items.length] as [string, number], ...categories].map(([name, count]) => {
            const active = (name === "all" && !category) || name === category;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(name === "all" ? null : name)}
                className={`rounded-full border px-3 py-1 text-xs transition ${name === "mcp" ? "" : "capitalize"} ${
                  active ? "border-fg bg-fg text-ink" : "border-line-strong text-fg-soft hover:bg-raised"
                }`}
              >
                {label(name)} <span className={active ? "text-ink/60" : "text-faint"}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {nothingYet && <ApiGridSkeleton caption="Loading the catalog" />}
      {!nothingYet && !bothDown && items.length > 0 && visible.length === 0 && (q || category) && (
        <p className="text-muted">{q ? `Nothing matches “${query.trim()}”.` : "Nothing in this category yet."}</p>
      )}

      <ul className="grid auto-rows-[9.5rem] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {registry === null && mpp !== null && !q && !category && (
          <li data-testid="catalog-registry-pending" aria-label="Loading Toolport registry servers" className="[&>div]:h-full">
            <ApiCardSkeleton />
          </li>
        )}
        {visible.slice(0, shown).map((item) => (
          <li
            key={item.key}
            data-testid="catalog-item"
            data-source={item.key.split(":")[0]}
            className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel p-4"
          >
            <div className="flex h-6 items-center gap-2.5">
              <ProviderIcon src={item.icon} provider={item.provider} />
              <h3 title={item.name} className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-6 text-fg">
                {item.name}
              </h3>
              <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 font-mono text-[11px] leading-4 text-fg-soft">{item.badge}</span>
            </div>
            <p className="mt-2 line-clamp-2 h-[2.5rem] text-xs leading-5 text-fg-soft">{item.description}</p>
            <div className="mt-auto flex h-5 items-center gap-3 text-xs leading-5">
              <span title={item.price} className="min-w-0 truncate font-mono text-fg">
                {item.price}
              </span>
              <span className={`shrink-0 text-muted ${item.category === "mcp" ? "" : "capitalize"}`}>{label(item.category)}</span>
              {item.verified && <span className="shrink-0 text-good">verified</span>}
              {item.link?.external && (
                <a
                  href={item.link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.link.ariaLabel}
                  className="ml-auto shrink-0 text-accent hover:underline"
                >
                  {item.link.label}
                </a>
              )}
              {item.link && !item.link.external && (
                <Link href={item.link.href} aria-label={item.link.ariaLabel} className="ml-auto shrink-0 text-accent hover:underline">
                  {item.link.label}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      {visible.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE * 2)}
          className="h-10 w-full rounded-xl border border-line-strong text-sm text-fg hover:bg-raised"
        >
          Show more ({visible.length - shown} left)
        </button>
      )}
    </section>
  );
}
