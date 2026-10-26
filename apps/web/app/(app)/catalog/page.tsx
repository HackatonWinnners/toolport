"use client";

import Link from "next/link";
import { useState } from "react";
import { Catalog } from "@/components/catalog/Catalog";

export default function CatalogPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl space-y-3">
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em] text-fg">
            Tools your agent can pay for.
          </h1>
          <p className="text-[15px] leading-relaxed text-fg-soft">
            MCP servers from the Toolport registry and paid APIs from MPP Router, bought per call in USDC on Stellar.
            Your agent sees the price before it pays and never spends past the caps you set. No API keys, no
            subscriptions.
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
        placeholder="Search tools and APIs"
        aria-label="Search tools and APIs"
        className="w-full rounded-[10px] border border-line-strong bg-panel px-4 py-2.5 text-sm text-fg placeholder:text-faint focus:border-good focus:outline-none"
      />

      <Catalog query={query} />
    </div>
  );
}
