"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ErrorNote } from "@/components/ui";
import { useAgent } from "@/lib/agent";
import { api, GATEWAY_URL, type Server } from "@/lib/api";
import { catalogFrom, invoke, quote, refusal, searchCatalog, type CatalogTool, type Quote, type Run } from "@/lib/buyer";
import { RunsAside } from "./RunsAside";
import { Progress, ResultCard, type Attempt } from "./RunView";
import { ArgsCard, ToolOptions } from "./ToolPicker";

const SUGGESTIONS = ["swap XLM for USDC", "account balances", "ping"];

/** Starting arguments so a first-time visitor can run the demo tools without typing. */
function exampleArgs(tool: CatalogTool, address: string | null): Record<string, string> {
  const props = Object.keys(tool.inputSchema.properties ?? {});
  const known: Record<string, string> = { from: "XLM", to: "USDC", amount: "100", address: address ?? "" };
  return Object.fromEntries(props.map((p) => [p, known[p] ?? ""]));
}

export function Playground() {
  const params = useSearchParams();
  const { wallet, connectWallet, refreshAccount, budget, recordRun, error: walletError } = useAgent();

  const [servers, setServers] = useState<Server[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogTool | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<"quote" | "run" | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [shown, setShown] = useState<Run | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pendingRun = useRef(false);
  const askRef = useRef<HTMLInputElement>(null);

  const loadCatalog = useCallback(() => {
    setLoadError(null);
    api<{ servers: Server[] }>("/api/servers")
      .then((r) => setServers(r.servers))
      .catch((e: Error) => setLoadError(`The Toolport gateway at ${GATEWAY_URL} is unreachable (${e.message}). Try again in a moment.`));
  }, []);
  useEffect(loadCatalog, [loadCatalog]);

  const catalog = useMemo(() => catalogFrom(servers ?? []), [servers]);

  const options = useMemo(() => {
    if (asked === null) return [];
    const pinned = catalog.find((t) => t.id === pinnedId);
    if (!asked.trim()) return pinned ? catalog.filter((t) => t.serverId === pinned.serverId).slice(0, 3) : [];
    const found = searchCatalog(catalog, asked).slice(0, 3);
    return pinned && !found.some((t) => t.id === pinned.id) ? [pinned, ...found.slice(0, 2)] : found;
  }, [catalog, asked, pinnedId]);

  const select = useCallback(
    (tool: CatalogTool | null) => {
      setSelected(tool);
      setArgs(tool ? exampleArgs(tool, wallet?.address ?? null) : {});
      setPrice(null);
      setAttempt(null);
      setShown(null);
      setNote(null);
    },
    [wallet?.address],
  );

  const ask = useCallback(
    (q: string, toolId: string | null = null) => {
      setAsked(q);
      setPinnedId(toolId);
      const pinned = toolId ? catalog.find((t) => t.id === toolId) : undefined;
      select(pinned ?? (q.trim() ? searchCatalog(catalog, q)[0] ?? null : null));
    },
    [catalog, select],
  );

  // ?q= and ?tool=<serverId>:<name>, applied once the catalog is in.
  const paramKey = params.toString();
  useEffect(() => {
    if (!servers) return;
    const q = params.get("q") ?? "";
    const tool = params.get("tool");
    if (!q && !tool) return;
    setDraft("");
    ask(q, tool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers, paramKey]);

  // The elapsed-seconds counter.
  useEffect(() => {
    if (!attempt || attempt.endedAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [attempt]);

  // Fill the address argument once a wallet connects.
  useEffect(() => {
    if (wallet?.address) setArgs((a) => ("address" in a && !a.address ? { ...a, address: wallet.address } : a));
  }, [wallet?.address]);

  const typedArgs = (): Record<string, unknown> => {
    const props = selected?.inputSchema.properties ?? {};
    return Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, props[k]?.type === "number" || props[k]?.type === "integer" ? Number(v) : v]),
    );
  };

  const getPrice = async () => {
    if (!selected) return;
    setBusy("quote");
    setNote(null);
    try {
      setPrice(await quote(selected, typedArgs()));
    } catch (e) {
      setNote(`Couldn't get a price: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const finish = (tool: CatalogTool, callArgs: Record<string, unknown>, outcome: Omit<Run, "id" | "at" | "tool" | "args">) => {
    const entry: Run = { id: crypto.randomUUID(), at: new Date().toISOString(), tool: tool.name, args: callArgs, server: tool.serverName, ...outcome };
    recordRun(entry);
    setShown(entry);
    return entry;
  };

  const run = async () => {
    if (!selected || !budget || busy) return;
    const tool = selected;
    const paid = tool.priceUnits > 0;
    if (paid && !wallet) {
      pendingRun.current = true;
      setNote("Connect Freighter to sign the USDC payment. The run continues once it's connected.");
      await connectWallet();
      return;
    }
    if (paid && wallet?.wrongNetwork) return setNote("Freighter is on the wrong network. Switch it to Testnet, then reconnect.");

    const callArgs = typedArgs();
    setBusy("run");
    setNote(null);
    setShown(null);
    setAttempt({ paid, startedAt: Date.now(), quoted: !!price, signed: false, settled: false, ran: false });
    try {
      if (paid) {
        let q = price;
        if (!q) {
          q = await quote(tool, callArgs);
          setPrice(q);
          setAttempt((a) => a && { ...a, quoted: true });
        }
        const why = refusal(budget, q.amountUnits);
        if (why) return void finish(tool, callArgs, { status: "refused", amountUnits: 0, text: why });
      }
      const outcome = await invoke(tool, callArgs, wallet?.address ?? "", budget, {
        onSigned: () => setAttempt((a) => a && { ...a, signed: true }),
      });
      setAttempt((a) => a && { ...a, ran: outcome.status !== "failed", settled: outcome.status === "paid" });
      finish(tool, callArgs, outcome);
      if (outcome.status === "paid") void refreshAccount();
    } catch (e) {
      finish(tool, callArgs, { status: "failed", amountUnits: 0, text: (e as Error).message });
    } finally {
      setBusy(null);
      setAttempt((a) => a && { ...a, endedAt: Date.now() });
    }
  };

  // A paid run that waited for Freighter continues once the wallet is connected.
  useEffect(() => {
    if (wallet && pendingRun.current) {
      pendingRun.current = false;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  useEffect(() => {
    if (!walletError) return;
    pendingRun.current = false;
    setNote(null);
  }, [walletError]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q) return;
    setDraft("");
    ask(q);
  };

  const newRun = () => {
    setAsked(null);
    setPinnedId(null);
    select(null);
    askRef.current?.focus();
  };

  const pick = (r: Run) => {
    const tool = catalog.find((t) => t.name === r.tool && (!r.server || t.serverName === r.server));
    if (tool && tool.id !== selected?.id) {
      setAsked(asked ?? "");
      setPinnedId(tool.id);
      setSelected(tool);
      setPrice(null);
    }
    if (tool) setArgs(Object.fromEntries(Object.entries(r.args).map(([k, v]) => [k, String(v)])));
    setAttempt(null);
    setShown(r);
  };

  const blocked = budget && price ? refusal(budget, price.amountUnits) : null;
  const paid = (selected?.priceUnits ?? 0) > 0;
  const runningLabel = !paid ? "Running…" : !attempt?.quoted ? "Getting price…" : !attempt.signed ? "Approve in Freighter…" : "Settling…";
  const message = loadError ?? note ?? walletError;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
      <RunsAside runs={budget?.runs ?? []} activeId={shown?.id ?? null} onNew={newRun} onPick={pick} />

      <div className="flex min-h-[calc(100vh-140px)] min-w-0 flex-col">
        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-[22px] pb-6">
          {loadError && (
            <div className="flex flex-col gap-2">
              <ErrorNote message={loadError} />
              <button type="button" onClick={loadCatalog} className="self-start text-[13px] text-accent hover:text-fg">
                Retry
              </button>
            </div>
          )}

          {asked === null && !loadError && (
            <section className="flex flex-col gap-3 pt-6">
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.04em]">What does your agent need?</h1>
              <p className="max-w-xl text-[15px] text-fg-soft">
                Describe a tool. Toolport finds it in the catalog, shows the exact price, and pays per call in USDC on Stellar, never
                above your budget.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!servers}
                    onClick={() => ask(s)}
                    className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-fg-soft hover:border-line-hover hover:text-fg disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {!servers && <p className="text-[13px] text-muted">Loading the catalog…</p>}
            </section>
          )}

          {asked && (
            <div
              data-testid="user-bubble"
              className="max-w-[80%] self-end break-words rounded-[18px_18px_6px_18px] bg-bubble px-4 py-3 text-[15px]"
            >
              {asked}
            </div>
          )}

          {asked !== null &&
            (options.length ? (
              <ToolOptions tools={options} selectedId={selected?.id ?? null} onSelect={select} />
            ) : (
              <p className="text-[17px] leading-normal tracking-[-0.01em]">
                Nothing in the catalog fits that yet. Try &ldquo;swap path&rdquo; or &ldquo;account balances&rdquo;.
              </p>
            ))}

          {selected && budget && (
            <ArgsCard
              tool={selected}
              args={args}
              onArg={(name, value) => {
                setArgs((a) => ({ ...a, [name]: value }));
                setPrice(null);
              }}
              quote={price}
              refused={blocked}
              perCallUnits={budget.perCallUnits}
              busy={busy}
              runningLabel={runningLabel}
              canPay={!blocked && !(paid && wallet?.wrongNetwork)}
              onQuote={getPrice}
              onRun={run}
            />
          )}

          {!loadError && <ErrorNote message={message} />}

          {attempt && <Progress attempt={attempt} now={now} />}

          {shown && <ResultCard run={shown} server={shown.server} />}
        </div>

        <div className="sticky bottom-0 bg-ink pb-4 pt-3 sm:pb-6">
          <form onSubmit={submit} className="mx-auto flex max-w-[712px] flex-col gap-2">
            <label htmlFor="ask" className="sr-only">
              Describe a tool you need
            </label>
            <div className="flex items-center gap-2.5 rounded-[18px] border border-line-strong bg-panel py-2 pl-[18px] pr-2 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.7)] focus-within:border-fg focus-within:shadow-[0_0_0_3px_rgba(92,195,149,.22)]">
              <input
                id="ask"
                ref={askRef}
                data-testid="ask-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Describe a tool you need, like “swap XLM for USDC”"
                autoComplete="off"
                className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
              />
              <button
                type="submit"
                data-testid="ask-submit"
                aria-label="Search tools"
                disabled={!servers}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fg text-ink hover:bg-white disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-muted">Getting a price is free. Nothing is signed until you press Pay.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
