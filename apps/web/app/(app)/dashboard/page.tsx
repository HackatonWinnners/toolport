"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, ErrorNote, PriceTag } from "@/components/ui";
import { api, short, type AccountStatus, type Server } from "@/lib/api";
import { SellerConnect, SellerIdentity } from "@/components/seller/SellerConnect";
import { useSession } from "@/lib/session";

export default function DashboardPage() {
  const { address, token } = useSession();
  const [servers, setServers] = useState<Server[] | null>(null);
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setServers((await api<{ servers: Server[] }>("/api/servers?mine=true", { token })).servers);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (address) api<AccountStatus>(`/api/accounts/${address}`).then(setAccount).catch(() => setAccount(null));
  }, [address]);

  if (!address) return <SellerConnect />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-fg">Your servers</h1>
          <p className="mt-1 text-sm text-fg-soft">Revenue goes to {short(address)} in USDC.</p>
          {account && (
            <div className="mt-2">
              <TrustlineBadge account={account} />
            </div>
          )}
        </div>
        <SellerIdentity />
      </div>

      <RegisterForm token={token!} onCreated={load} />

      <ErrorNote message={error} />
      {servers?.length === 0 && <p className="text-muted">No servers yet. Paste an MCP URL above to register one.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {servers?.map((s) => (
          <Link key={s.id} href={`/servers/${s.id}`}>
            <Card className="h-full space-y-3 transition hover:border-line-hover hover:bg-raised">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold tracking-tight text-fg">{s.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${s.listed ? "bg-good/15 text-good" : "bg-raised text-muted"}`}
                >
                  {s.listed ? "listed" : "unlisted"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.tools.map((t) => (
                  <span key={t.name} className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1">
                    <span className="font-mono text-xs text-fg-soft">{t.name}</span>
                    <PriceTag usd={t.priceUsd} />
                  </span>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TrustlineBadge({ account }: { account: AccountStatus }) {
  if (!account.exists) return <span className="text-sm text-warn">Wallet not funded on this network</span>;
  if (!account.hasUsdcTrustline) {
    return (
      <span className="text-sm text-warn">
        Add a USDC trustline in Freighter before your first sale, or payments will fail
      </span>
    );
  }
  return <span className="text-sm text-good">USDC trustline ok · balance {account.usdc}</span>;
}

function RegisterForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [upstreamUrl, setUpstreamUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold text-fg">Register a server</h2>
        <p className="text-sm text-fg-soft">Paste its MCP URL. We read its tools; you set prices next.</p>
      </div>
      <form
        className="grid gap-3 md:grid-cols-[2fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const server = await api<Server>("/api/servers", {
              method: "POST",
              token,
              body: JSON.stringify({
                upstreamUrl,
                name: name || undefined,
                description: description || undefined,
              }),
            });
            setUpstreamUrl("");
            setName("");
            setDescription("");
            onCreated();
            window.location.href = `/servers/${server.id}`;
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          required
          value={upstreamUrl}
          onChange={(e) => setUpstreamUrl(e.target.value)}
          placeholder="https://your-server.example/mcp (Streamable HTTP)"
          className="rounded-[10px] border border-line-strong bg-ink px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-good focus:outline-none"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="rounded-[10px] border border-line-strong bg-ink px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-good focus:outline-none"
        />
        <Button type="submit" disabled={busy}>{busy ? "Reading tools…" : "Register"}</Button>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One-line description for the catalog (optional)"
          className="rounded-[10px] border border-line-strong bg-ink px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-good focus:outline-none md:col-span-3"
        />
      </form>
      <ErrorNote message={error} />
    </Card>
  );
}
