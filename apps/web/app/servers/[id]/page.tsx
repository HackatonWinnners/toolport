"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Code, ErrorNote, Stat, UrlRow } from "@/components/ui";
import { api, claudeDesktopConfig, EXPLORER, short, usd, type Call, type Server, type Stats, type Tool } from "@/lib/api";
import { useSession } from "@/lib/session";

const STATUS_STYLE: Record<Call["status"], string> = {
  paid: "text-good",
  free: "text-muted",
  verify_failed: "text-bad",
  tool_failed: "text-warn",
  settle_failed: "text-bad",
  payment_unknown: "text-warn",
};

export default function ServerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, address } = useSession();
  const [server, setServer] = useState<Server | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api<Server>(`/api/servers/${id}`);
      setServer(s);
      if (token && s.owner === address) {
        const [st, cl] = await Promise.all([
          api<Stats>(`/api/servers/${id}/stats`, { token }),
          api<{ calls: Call[] }>(`/api/servers/${id}/calls?limit=50`, { token }),
        ]);
        setStats(st);
        setCalls(cl.calls);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, token, address]);

  useEffect(() => {
    void load();
    // Live-ish: revenue ticks up during the demo without a reload.
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  if (!server) return error ? <ErrorNote message={error} /> : <p className="text-muted">Loading…</p>;
  const isOwner = server.owner === address && !!token;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">{server.name}</h1>
          <a
            href={`${EXPLORER}/account/${server.payTo}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-muted hover:text-white"
          >
            payTo {short(server.payTo)} ↗
          </a>
        </div>
        {server.description && <p className="text-muted">{server.description}</p>}
        <UrlRow url={server.mcpUrl} />
      </div>

      {isOwner && stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Revenue" value={`$${Number(stats.revenueUsd).toFixed(2)}`} hint="USDC, settled on-chain" />
          <Stat label="Paid calls" value={stats.paidCalls} />
          <Stat label="All calls" value={stats.calls} />
          <Stat label="Payers" value={stats.payers} hint="distinct wallets" />
        </div>
      )}

      <Card className="space-y-3">
        <h2 className="font-semibold">Tools and prices</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2">Tool</th>
              <th className="py-2">Price (USD per call)</th>
              <th className="py-2">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {server.tools.map((tool) => (
              <ToolRow key={tool.name} serverId={server.id} tool={tool} editable={isOwner} token={token} onSaved={load} />
            ))}
          </tbody>
        </table>
        {isOwner && (
          <p className="text-xs text-muted">
            0 = free. Failed tool calls are never charged. New upstream tools start free until you price them
            (Refresh to pick them up).
          </p>
        )}
      </Card>

      {isOwner && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent calls</h2>
            <span className="text-xs text-muted">updates every 4s</span>
          </div>
          {calls.length === 0 ? (
            <p className="text-sm text-muted">No calls yet. Try the config below.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Tool</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Payer</th>
                    <th className="py-2 pr-3">Latency</th>
                    <th className="py-2">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {calls.map((c) => (
                    <tr key={c.id} title={c.error ?? undefined}>
                      <td className="py-2 pr-3 text-muted">{new Date(c.createdAt).toLocaleTimeString()}</td>
                      <td className="py-2 pr-3 font-mono">{c.tool}</td>
                      <td className={`py-2 pr-3 ${STATUS_STYLE[c.status]}`}>{c.status.replace("_", " ")}</td>
                      <td className="py-2 pr-3 font-mono">{c.status === "paid" ? usd(c.amountUsd) : "–"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{c.payer ? short(c.payer) : "–"}</td>
                      <td className="py-2 pr-3 text-muted">{(c.latencyMs / 1000).toFixed(1)}s</td>
                      <td className="py-2">
                        {c.explorerUrl ? (
                          <a href={c.explorerUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline">
                            {c.txHash!.slice(0, 10)}… ↗
                          </a>
                        ) : (
                          "–"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-semibold">Use it from Claude Desktop or Cursor</h2>
        <p className="text-sm text-muted">
          1. <code className="font-mono">npx stellarpay wallet create --usdc 5</code> (testnet wallet with USDC, no XLM
          needed for fees). 2. Add to claude_desktop_config.json:
        </p>
        <Code>{claudeDesktopConfig([server.mcpUrl])}</Code>
        <p className="text-sm text-muted">Or from the terminal:</p>
        <Code>{`npx stellarpay tools ${server.mcpUrl}`}</Code>
      </Card>

      {isOwner && (
        <OwnerActions
          server={server}
          token={token!}
          onChanged={load}
          onDeleted={() => router.push("/dashboard")}
        />
      )}
    </div>
  );
}

function ToolRow({
  serverId,
  tool,
  editable,
  token,
  onSaved,
}: {
  serverId: string;
  tool: Tool;
  editable: boolean;
  token: string | null;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(tool.priceUsd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = price !== tool.priceUsd;

  useEffect(() => setPrice(tool.priceUsd), [tool.priceUsd]);

  const save = async (patch: { price?: string; enabled?: boolean }) => {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/servers/${serverId}/tools/${encodeURIComponent(tool.name)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td className="py-2 pr-3 align-top">
        <div className="font-mono">{tool.name}</div>
        <div className="text-xs text-muted">{tool.description}</div>
        {error && <div className="text-xs text-bad">{error}</div>}
      </td>
      <td className="py-2 pr-3 align-top">
        {editable ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save({ price });
            }}
          >
            <span className="text-muted">$</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="w-24 rounded-md border border-line bg-ink px-2 py-1 font-mono text-sm"
            />
            {dirty && (
              <Button type="submit" disabled={saving}>
                Save
              </Button>
            )}
          </form>
        ) : (
          <span className="font-mono">{usd(tool.priceUsd)}</span>
        )}
      </td>
      <td className="py-2 align-top">
        <input
          type="checkbox"
          checked={tool.enabled}
          disabled={!editable || saving}
          onChange={(e) => void save({ enabled: e.target.checked })}
        />
      </td>
    </tr>
  );
}

function OwnerActions({
  server,
  token,
  onChanged,
  onDeleted,
}: {
  server: Server;
  token: string;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Settings</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => run(() => api(`/api/servers/${server.id}/refresh`, { method: "POST", token }))}>
          Refresh tools from upstream
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            run(() =>
              api(`/api/servers/${server.id}`, { method: "PATCH", token, body: JSON.stringify({ listed: !server.listed }) }),
            )
          }
        >
          {server.listed ? "Unlist from registry" : "List in registry"}
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm(`Delete ${server.name}? The paid URL stops working.`)) return;
            try {
              await api(`/api/servers/${server.id}`, { method: "DELETE", token });
              onDeleted();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Delete
        </Button>
      </div>
      <p className="text-xs text-muted">Upstream: <code className="font-mono">{server.upstreamUrl}</code></p>
      <ErrorNote message={error} />
    </Card>
  );
}
