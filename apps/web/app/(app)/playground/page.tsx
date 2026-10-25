"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Code, ErrorNote, PriceTag } from "@/components/ui";
import { api, EXPLORER, NETWORK, routerConfig, short, type AccountStatus, type Server } from "@/lib/api";
import {
  catalogFrom,
  invoke,
  loadBudget,
  quote,
  refusal,
  saveBudget,
  searchCatalog,
  toUnits,
  usdc,
  type Budget,
  type CatalogTool,
  type Quote,
  type Run,
} from "@/lib/buyer";
import { connectWallet as connectSigner } from "@/lib/signer";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

/** Starting arguments so a first-time visitor can run the demo tools without typing. */
function exampleArgs(tool: CatalogTool, address: string | null): Record<string, string> {
  const props = Object.keys(tool.inputSchema.properties ?? {});
  const known: Record<string, string> = { from: "XLM", to: "USDC", amount: "100", address: address ?? "" };
  return Object.fromEntries(props.map((p) => [p, known[p] ?? ""]));
}

export default function AgentPage() {
  const [servers, setServers] = useState<Server[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogTool | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<"quote" | "run" | null>(null);
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [wallet, setWallet] = useState<{ address: string; account?: AccountStatus; wrongNetwork?: boolean } | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);

  useEffect(() => {
    setBudget(loadBudget());
    api<{ servers: Server[] }>("/api/servers")
      .then((r) => setServers(r.servers))
      .catch((e) => setError(`Gateway unreachable: ${e.message}`));
  }, []);

  const catalog = useMemo(() => catalogFrom(servers ?? []), [servers]);
  const results = useMemo(() => searchCatalog(catalog, query), [catalog, query]);

  const updateBudget = (next: Budget) => {
    setBudget(next);
    saveBudget(next);
  };

  const select = (tool: CatalogTool) => {
    setSelected(tool);
    setArgs(exampleArgs(tool, wallet?.address ?? null));
    setPrice(null);
    setLastRun(null);
    setError(null);
  };

  const connectWallet = async () => {
    setError(null);
    try {
      const { address, networkPassphrase } = await connectSigner();
      const wrongNetwork = NETWORK === "stellar:testnet" && networkPassphrase !== TESTNET_PASSPHRASE;
      const account = await api<AccountStatus>(`/api/accounts/${address}`).catch(() => undefined);
      setWallet({ address, account, wrongNetwork });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const typedArgs = (): Record<string, unknown> => {
    const props = selected?.inputSchema.properties ?? {};
    return Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, props[k]?.type === "number" || props[k]?.type === "integer" ? Number(v) : v]),
    );
  };

  const getPrice = async () => {
    if (!selected) return;
    setBusy("quote");
    setError(null);
    try {
      setPrice(await quote(selected, typedArgs()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    if (!selected || !budget) return;
    if (selected.priceUnits > 0 && !wallet) return setError("Connect Freighter first: it signs the USDC payment.");
    setBusy("run");
    setError(null);
    try {
      const outcome = await invoke(selected, typedArgs(), wallet?.address ?? "", budget);
      const entry: Run = { id: crypto.randomUUID(), at: new Date().toISOString(), tool: selected.name, args: typedArgs(), ...outcome };
      setLastRun(entry);
      updateBudget({ ...budget, spentUnits: budget.spentUnits + outcome.amountUnits, runs: [entry, ...budget.runs].slice(0, 20) });
      if (outcome.status === "paid" && wallet) {
        api<AccountStatus>(`/api/accounts/${wallet.address}`).then((account) => setWallet({ ...wallet, account }), () => {});
      }
    } finally {
      setBusy(null);
    }
  };

  const blocked = budget && price ? refusal(budget, price.amountUnits) : null;
  const remaining = budget ? budget.capUnits - budget.spentUnits : 0;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">One MCP for every paid tool. Your agent gets a budget.</h1>
        <p className="max-w-3xl text-muted">
          Search tools across catalogs, see the exact price before buying, and pay per call in USDC on Stellar via x402.
          Hard caps, no API keys, no subscriptions, and a transaction for every purchase. Try the flow yourself below,
          then hand the same router to your agent.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <StepTitle n={1} title="Find a tool" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='What does your agent need? e.g. "swap path", "account balances"'
              className="w-full rounded-lg border border-line bg-ink px-4 py-2.5 text-sm"
            />
            {servers === null && !error && <p className="text-sm text-muted">Loading catalog…</p>}
            <ul className="divide-y divide-line">
              {results.map((tool) => (
                <li key={tool.id}>
                  <button
                    onClick={() => select(tool)}
                    className={`flex w-full items-start gap-3 py-3 text-left ${selected?.id === tool.id ? "text-white" : "text-slate-300 hover:text-white"}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${selected?.id === tool.id ? "bg-accent" : "bg-line"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <code className="font-mono text-sm">{tool.name}</code>
                        <PriceTag usd={String(tool.priceUnits / 10_000_000)} />
                        <span className="text-xs text-muted">{tool.serverName}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{tool.description}</span>
                    </span>
                  </button>
                </li>
              ))}
              {servers !== null && results.length === 0 && <li className="py-3 text-sm text-muted">No tool matches.</li>}
            </ul>
          </Card>

          {selected && (
            <Card className="space-y-4">
              <StepTitle n={2} title={`Price and run ${selected.name}`} />
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(selected.inputSchema.properties ?? {}).map(([name, prop]) => (
                  <label key={name} className="space-y-1 text-sm">
                    <span className="text-muted">
                      {name}
                      {selected.inputSchema.required?.includes(name) && " *"}
                    </span>
                    <input
                      value={args[name] ?? ""}
                      onChange={(e) => {
                        setArgs({ ...args, [name]: e.target.value });
                        setPrice(null);
                      }}
                      placeholder={prop.description}
                      className="w-full rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs"
                    />
                  </label>
                ))}
              </div>

              {selected.priceUnits > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="ghost" onClick={getPrice} disabled={busy !== null}>
                    {busy === "quote" ? "Asking…" : "Get price (free, no signature)"}
                  </Button>
                  <Button onClick={run} disabled={busy !== null || !price || !!blocked}>
                    {busy === "run" ? "Approve in Freighter…" : price ? `Pay ${usdc(price.amountUnits)} and run` : "Pay and run"}
                  </Button>
                </div>
              ) : (
                <Button onClick={run} disabled={busy !== null}>
                  {busy === "run" ? "Running…" : "Run (free)"}
                </Button>
              )}

              {price && (
                <p className={`text-sm ${blocked ? "text-bad" : "text-muted"}`}>
                  {blocked
                    ? `Refused before signing: ${blocked}. Raise the budget to continue.`
                    : `Quote: ${usdc(price.amountUnits)} USDC to ${short(price.payTo)} on ${price.network}. Within your budget.`}
                </p>
              )}
            </Card>
          )}

          {lastRun && (
            <Card className="space-y-3">
              <StepTitle n={3} title="Result" />
              <RunStatus run={lastRun} />
              <pre className="max-h-96 overflow-auto rounded-lg border border-line bg-ink p-3 font-mono text-xs text-slate-300">
                {lastRun.text}
              </pre>
            </Card>
          )}
          <ErrorNote message={error} />
        </div>

        <aside className="space-y-6">
          <Card className="space-y-3">
            <h2 className="font-semibold">Wallet</h2>
            {wallet ? (
              <div className="space-y-1 text-sm">
                <a href={`${EXPLORER}/account/${wallet.address}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline">
                  {short(wallet.address)}
                </a>
                <p className="text-muted">
                  {wallet.account?.hasUsdcTrustline ? `${wallet.account.usdc} USDC` : "No USDC trustline yet"}
                  {wallet.account && ` · ${Number(wallet.account.xlm).toFixed(1)} XLM`}
                </p>
                {wallet.wrongNetwork && <p className="text-bad">Switch Freighter to Testnet.</p>}
                {wallet.account && !Number(wallet.account.usdc) && (
                  <p className="text-xs text-muted">
                    Get test USDC at{" "}
                    <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      faucet.circle.com
                    </a>{" "}
                    (Stellar testnet).
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-muted">Freighter signs each USDC payment. The network fee is sponsored, so no XLM is spent.</p>
                <Button onClick={connectWallet}>Connect Freighter</Button>
              </>
            )}
          </Card>

          {budget && (
            <Card className="space-y-3">
              <h2 className="font-semibold">Budget</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <LimitInput label="Total" units={budget.capUnits} onChange={(capUnits) => updateBudget({ ...budget, capUnits })} />
                <LimitInput label="Per call" units={budget.perCallUnits} onChange={(perCallUnits) => updateBudget({ ...budget, perCallUnits })} />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink">
                <div className="h-full bg-accent" style={{ width: `${Math.min(100, (budget.spentUnits / Math.max(1, budget.capUnits)) * 100)}%` }} />
              </div>
              <p className="text-sm text-muted">
                {usdc(budget.spentUnits)} spent · {usdc(Math.max(0, remaining))} left
              </p>
              {budget.runs.length > 0 && (
                <ul className="space-y-2 border-t border-line pt-3">
                  {budget.runs.slice(0, 6).map((r) => (
                    <li key={r.id}>
                      <RunStatus run={r} compact />
                    </li>
                  ))}
                </ul>
              )}
              <button className="text-xs text-muted hover:text-white" onClick={() => updateBudget({ ...budget, spentUnits: 0, runs: [] })}>
                Reset history
              </button>
            </Card>
          )}

          <Card className="space-y-3">
            <h2 className="font-semibold">Give it to your agent</h2>
            <p className="text-sm text-muted">
              The router exposes <code className="font-mono">search_tools</code>, <code className="font-mono">probe_tool</code>,{" "}
              <code className="font-mono">invoke_tool</code> and <code className="font-mono">get_budget</code> over MCP, with a budget
              kept on disk and an idempotency key on every purchase. Add to <code className="font-mono">claude_desktop_config.json</code>:
            </p>
            <Code>{routerConfig()}</Code>
            <p className="text-xs text-muted">
              Selling a tool instead? <Link href="/dashboard" className="text-accent hover:underline">List your MCP server</Link>.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 font-mono text-xs text-accent">{n}</span>
      {title}
    </h2>
  );
}

function LimitInput({ label, units, onChange }: { label: string; units: number; onChange: (units: number) => void }) {
  const [value, setValue] = useState((units / 10_000_000).toString());
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted">{label} (USDC)</span>
      <input
        value={value}
        inputMode="decimal"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const next = toUnits(value);
          if (next > 0) onChange(next);
          else setValue((units / 10_000_000).toString());
        }}
        className="w-full rounded-lg border border-line bg-ink px-3 py-1.5 font-mono text-xs"
      />
    </label>
  );
}

function RunStatus({ run, compact = false }: { run: Run; compact?: boolean }) {
  const color = { paid: "text-good", free: "text-muted", refused: "text-warn", failed: "text-bad" }[run.status];
  return (
    <div className={`flex flex-wrap items-center gap-x-2 ${compact ? "text-xs" : "text-sm"}`}>
      <span className={`font-medium ${color}`}>{run.status === "paid" ? `paid ${usdc(run.amountUnits)}` : run.status}</span>
      <code className="font-mono text-muted">{run.tool}</code>
      {run.tx && (
        <a href={`${EXPLORER}/tx/${run.tx}`} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">
          tx {run.tx.slice(0, 8)}…
        </a>
      )}
      {compact && run.status === "refused" && <span className="w-full text-muted">{run.text}</span>}
    </div>
  );
}
