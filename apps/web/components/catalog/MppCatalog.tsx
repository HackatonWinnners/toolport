"use client";

import { useEffect, useMemo, useState } from "react";
import { Code } from "@/components/ui";
import { ApiGridSkeleton } from "@/components/brand/Skeleton";

// MPP Router's paid APIs on Stellar mainnet, from public/catalog/mpprouter.json (scripts/import-mpprouter.mjs).
// The browser playground runs on testnet, so these are bought by an agent through the router.

interface MppService {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  price: string;
  method: string;
  verified: boolean;
  docs: string;
}

const PAGE = 24;
const label = (category: string) => (category === "ai" ? "AI" : category);
const ROUTER_COMMAND =
  "toolport router --network stellar:pubnet --rpc-url <mainnet RPC> \\\n  --manifest catalog/mpprouter.mainnet.json --max-per-call 0.05 --budget 1";

export function MppCatalog({ query }: { query: string }) {
  const [services, setServices] = useState<MppService[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    fetch("/catalog/mpprouter.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { services: MppService[] }) => setServices(data.services))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => setShown(PAGE), [query, category]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of services ?? []) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [services]);

  const q = query.trim().toLowerCase();
  const visible = (services ?? []).filter(
    (s) =>
      (!category || s.category === category) &&
      (!q || `${s.name} ${s.provider} ${s.description} ${s.category}`.toLowerCase().includes(q)),
  );

  if (failed) return null;

  return (
    <section aria-labelledby="mpp-h" className="space-y-5 border-t border-line pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <h2 id="mpp-h" className="text-2xl font-semibold tracking-[-0.03em] text-fg">
            {services ? `${services.length} paid APIs` : "Paid APIs"} from MPP Router
          </h2>
          <p className="text-[15px] leading-relaxed text-fg-soft">
            Search, LLMs, market data, maps, scraping and more, paid per request in USDC on Stellar mainnet. Your agent
            buys them through the Toolport router under the same caps; the browser playground stays on testnet.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-good" /> Stellar mainnet
        </span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-fg">Give them to your agent</summary>
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted">Run the router on mainnet with the MPP Router manifest from the repo:</p>
          <Code>{ROUTER_COMMAND}</Code>
        </div>
      </details>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {[["all", services?.length ?? 0] as [string, number], ...categories].map(([name, count]) => {
            const active = (name === "all" && !category) || name === category;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(name === "all" ? null : name)}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                  active ? "border-fg bg-fg text-ink" : "border-line-strong text-fg-soft hover:bg-raised"
                }`}
              >
                {label(name)} <span className={active ? "text-ink/60" : "text-faint"}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {services === null && <ApiGridSkeleton caption="Loading MPP Router APIs" />}
      {services && visible.length === 0 && <p className="text-muted">No MPP Router API matches.</p>}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.slice(0, shown).map((s) => (
          <li key={s.id} data-testid="mpp-service" className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 text-[15px] font-semibold leading-snug text-fg">{s.name}</h3>
              <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 font-mono text-[11px] text-fg-soft">{s.method}</span>
            </div>
            {!s.name.toLowerCase().includes(s.description.toLowerCase()) && (
              <p className="line-clamp-2 text-xs leading-relaxed text-fg-soft">{s.description}</p>
            )}
            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
              <span className="font-mono text-fg">{s.price}</span>
              <span className="capitalize text-muted">{label(s.category)}</span>
              {s.verified && (
                <span className="inline-flex items-center gap-1 text-good">
                  <span className="h-1.5 w-1.5 rounded-full bg-good" /> paid run verified
                </span>
              )}
              <a href={s.docs} target="_blank" rel="noreferrer" className="ml-auto text-accent hover:underline">
                Docs ↗
              </a>
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
