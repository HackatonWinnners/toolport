"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { DOCS_URL, EXPLORER, FAUCET_URL, NETWORK, short } from "@/lib/api";
import { useAgent } from "@/lib/agent";
import { toUnits, usdc } from "@/lib/buyer";
import { Popover } from "./Popover";

const NAV = [
  { href: "/catalog", label: "Catalog" },
  { href: "/dashboard", label: "Sell" },
];

export function AppHeader() {
  const path = usePathname();
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" aria-label="Toolport home" className="flex items-center gap-2">
          <LogoMark size={31} />
          <Wordmark size={20} />
        </Link>
        <nav data-testid="app-nav" aria-label="App" className="flex flex-wrap gap-x-5 text-sm">
          {NAV.map((item) => {
            const active = path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`border-b-[1.5px] py-2 ${active ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:text-fg"}`}
              >
                {item.label}
              </Link>
            );
          })}
          {DOCS_URL && (
            <a href={DOCS_URL} className="border-b-[1.5px] border-transparent py-2 text-muted hover:text-fg">
              Docs
            </a>
          )}
        </nav>
        <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
          <BudgetPill />
          <NetworkPill />
          <div className="ml-auto sm:ml-0">
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}

function NetworkPill() {
  const testnet = NETWORK !== "stellar:pubnet";
  return (
    <span data-testid="network-pill" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${testnet ? "bg-held" : "bg-good"}`} />
      {testnet ? "Testnet" : "Mainnet"}
    </span>
  );
}

function BudgetPill() {
  const { budget, updateBudget } = useAgent();
  if (!budget) return <span className="h-10 w-48 rounded-xl border border-line bg-panel" aria-hidden="true" />;
  const remaining = Math.max(0, budget.capUnits - budget.spentUnits);
  const spentPct = Math.min(100, (budget.spentUnits / Math.max(1, budget.capUnits)) * 100);
  return (
    <Popover
      testId="budget-pill"
      align="left"
      label={`Budget: ${usdc(remaining)} left of ${usdc(budget.capUnits)}, ${usdc(budget.perCallUnits)} per call. Edit budget`}
      className="flex h-10 items-center gap-2.5 rounded-xl border border-line bg-panel px-3.5 hover:border-line-hover"
      trigger={
        <>
          <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span className="bg-good" style={{ width: `${spentPct}%` }} />
          </span>
          <span className="font-mono text-[12.5px]">{usdc(remaining)} left</span>
          <span className="text-xs text-muted">· {usdc(budget.perCallUnits)} / call</span>
        </>
      }
    >
      {() => (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Budget</h2>
            <p className="mt-0.5 text-xs text-muted">
              {usdc(budget.spentUnits)} spent of {usdc(budget.capUnits)}. Calls above a cap are refused before anything is signed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LimitInput
              testId="budget-total-input"
              label="Total"
              units={budget.capUnits}
              onChange={(capUnits) => updateBudget({ ...budget, capUnits })}
            />
            <LimitInput
              testId="budget-percall-input"
              label="Per call"
              units={budget.perCallUnits}
              onChange={(perCallUnits) => updateBudget({ ...budget, perCallUnits })}
            />
          </div>
          <button
            type="button"
            onClick={() => updateBudget({ ...budget, spentUnits: 0, runs: [] })}
            className="h-9 w-full rounded-[10px] border border-line-strong text-[13px] hover:bg-raised"
          >
            Reset spending and runs
          </button>
        </div>
      )}
    </Popover>
  );
}

/** Commits as soon as the value is a positive number, so a test can type and click straight away. */
function LimitInput({ label, units, onChange, testId }: { label: string; units: number; onChange: (u: number) => void; testId: string }) {
  const [value, setValue] = useState((units / 10_000_000).toString());
  useEffect(() => {
    setValue((v) => (toUnits(v) === units ? v : (units / 10_000_000).toString()));
  }, [units]);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label} (USDC)</span>
      <input
        data-testid={testId}
        value={value}
        inputMode="decimal"
        onChange={(e) => {
          setValue(e.target.value);
          const next = toUnits(e.target.value);
          if (next > 0 && next !== units) onChange(next);
        }}
        onBlur={() => toUnits(value) > 0 || setValue((units / 10_000_000).toString())}
        className="h-10 w-full rounded-[10px] border border-line-strong bg-ink px-3 font-mono text-[13px] outline-none focus:border-fg focus:shadow-[0_0_0_3px_rgba(92,195,149,.22)]"
      />
    </label>
  );
}

function WalletButton() {
  const { wallet, connectWallet, refreshAccount } = useAgent();
  const [connecting, setConnecting] = useState(false);

  if (!wallet) {
    return (
      <button
        type="button"
        data-testid="wallet-button"
        disabled={connecting}
        onClick={async () => {
          setConnecting(true);
          await connectWallet();
          setConnecting(false);
        }}
        className="flex h-10 items-center rounded-xl bg-fg px-3.5 text-[13px] font-medium text-ink hover:bg-white disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect Freighter"}
      </button>
    );
  }

  const balance = wallet.account
    ? wallet.account.hasUsdcTrustline
      ? `${Number(wallet.account.usdc ?? 0)} USDC`
      : "No USDC trustline"
    : "…";
  return (
    <Popover
      testId="wallet-button"
      label={`Wallet ${short(wallet.address)}, ${balance}. Open wallet menu`}
      className="flex h-10 items-center gap-2 rounded-xl bg-fg px-3.5 text-ink hover:bg-white"
      trigger={
        <>
          <span className="font-mono text-[12.5px]">{short(wallet.address)}</span>
          <span className="text-[12.5px] text-[#5E5C55]">{wallet.wrongNetwork ? "Wrong network" : balance}</span>
        </>
      }
    >
      {() => (
        <div className="space-y-3 text-sm">
          <div>
            <h2 className="font-semibold">Wallet</h2>
            <a
              href={`${EXPLORER}/account/${wallet.address}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all font-mono text-xs text-accent hover:underline"
            >
              {wallet.address}
            </a>
          </div>
          {wallet.wrongNetwork && <p className="text-bad">Switch Freighter to {NETWORK === "stellar:pubnet" ? "Mainnet" : "Testnet"}.</p>}
          {wallet.account && (
            <p className="text-muted">
              {balance} · {Number(wallet.account.xlm).toFixed(1)} XLM
            </p>
          )}
          {wallet.account && !Number(wallet.account.usdc) && (
            <p className="text-xs text-muted">
              Get test USDC at{" "}
              <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                faucet.circle.com
              </a>{" "}
              (Stellar testnet).
            </p>
          )}
          <button
            type="button"
            onClick={() => refreshAccount()}
            className="h-9 w-full rounded-[10px] border border-line-strong text-[13px] hover:bg-raised"
          >
            Refresh balance
          </button>
        </div>
      )}
    </Popover>
  );
}
