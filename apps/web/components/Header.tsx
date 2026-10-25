"use client";

import Link from "next/link";
import { useState } from "react";
import { NETWORK, short } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "./ui";

export function Header() {
  const { address, signIn, signInDev, signOut, signingIn, error } = useSession();
  const [devOpen, setDevOpen] = useState(false);
  const [devAddress, setDevAddress] = useState("");
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm">✦</span>
          StellarPay MCP
        </Link>
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/" className="hover:text-white">Agent</Link>
          <Link href="/registry" className="hover:text-white">Catalog</Link>
          <Link href="/dashboard" className="hover:text-white">Sell tools</Link>
        </nav>
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-xs text-muted">{NETWORK}</span>
        <div className="ml-auto flex items-center gap-2">
          {address ? (
            <>
              <span className="font-mono text-xs text-muted">{short(address)}</span>
              <Button variant="ghost" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <>
              <button className="text-xs text-muted hover:text-white" onClick={() => setDevOpen((v) => !v)}>
                dev
              </button>
              <Button onClick={signIn} disabled={signingIn}>
                {signingIn ? "Check Freighter…" : "Seller sign-in"}
              </Button>
            </>
          )}
        </div>
      </div>
      {!address && devOpen && (
        <form
          className="mx-auto flex max-w-6xl gap-2 px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            void signInDev(devAddress.trim());
          }}
        >
          <input
            value={devAddress}
            onChange={(e) => setDevAddress(e.target.value)}
            placeholder="G… address (gateway must run with AUTH_DISABLED=true)"
            className="flex-1 rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs"
          />
          <Button type="submit" variant="ghost">Use address</Button>
        </form>
      )}
      {error && <p className="mx-auto max-w-6xl px-4 pb-3 text-sm text-bad">{error}</p>}
    </header>
  );
}
