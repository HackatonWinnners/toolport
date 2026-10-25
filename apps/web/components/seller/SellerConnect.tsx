"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { short } from "@/lib/api";
import { useSession } from "@/lib/session";

const STEPS = [
  "Paste your MCP URL. We discover its tools.",
  "Set a price per tool, from $0.001.",
  "Revenue goes to the wallet you sign in with. We check its USDC trustline.",
  "Get your paid URL. Revenue and calls show up live.",
];

/** Signed-out state of the Sell page: Freighter sign-in, plus a dev-address form behind a toggle. */
export function SellerConnect() {
  const { signIn, signInDev, signingIn, error } = useSession();
  const [devOpen, setDevOpen] = useState(false);
  const [devAddress, setDevAddress] = useState("");

  return (
    <section
      data-testid="seller-connect"
      className="mx-auto flex max-w-4xl flex-wrap gap-8 rounded-[20px] border border-line bg-panel p-6 md:p-10"
    >
      <div className="flex min-w-[260px] flex-1 flex-col gap-4">
        <h1 className="text-3xl font-semibold leading-tight tracking-[-0.04em] text-fg">
          Already run an MCP server? Get paid per call.
        </h1>
        <p className="text-[15px] leading-relaxed text-fg-soft">
          Connect the Stellar wallet that should receive USDC. You sign a one-time message in Freighter, not a
          transaction.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button onClick={signIn} disabled={signingIn}>
            {signingIn ? "Check Freighter…" : "Connect Freighter"}
          </Button>
          <button
            type="button"
            aria-expanded={devOpen}
            onClick={() => setDevOpen((v) => !v)}
            className="text-xs text-muted hover:text-fg"
          >
            {devOpen ? "Hide dev sign-in" : "Dev sign-in"}
          </button>
        </div>
        {devOpen && (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const addr = devAddress.trim();
              if (addr) void signInDev(addr);
            }}
          >
            <input
              value={devAddress}
              onChange={(e) => setDevAddress(e.target.value)}
              placeholder="G… address (gateway must run with AUTH_DISABLED=true)"
              aria-label="Dev seller address"
              className="min-w-0 flex-1 rounded-[10px] border border-line-strong bg-ink px-3 py-2 font-mono text-xs text-fg placeholder:text-faint focus:border-good focus:outline-none"
            />
            <Button type="submit" variant="ghost">
              Use address
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>
      <ol className="flex min-w-[240px] flex-1 flex-col text-[15px] text-fg">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3.5 border-b border-line py-3 last:border-b-0">
            <span className="pt-0.5 font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Signed-in seller identity with a sign-out action. */
export function SellerIdentity() {
  const { address, signOut } = useSession();
  if (!address) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-full border border-line px-2.5 py-1 font-mono text-xs text-fg-soft" title={address}>
        {short(address)}
      </span>
      <Button variant="ghost" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}
