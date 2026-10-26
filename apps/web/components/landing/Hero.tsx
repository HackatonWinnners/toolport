import Link from "next/link";
import { txUrl } from "@/lib/api";
import { shortHash } from "./proof";
import { Ext, Section, cta, ghost } from "./parts";

const HERO_TX = "b3168b851ff33fc7cd7f64d1ef336bafa2187c64c5747cf39bcb99bc5e6efb76";

export function Hero() {
  return (
    <Section label="Introduction" className="flex flex-wrap items-center gap-14 pb-10 pt-12 sm:pt-[72px]">
      <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-[26px]">
        <h1 className="m-0 text-[clamp(42px,5.4vw,74px)] font-semibold leading-[1.02] tracking-[-0.05em]">
          <span data-testid="hero-title">Your agent can buy the tools it needs.</span>
          <br />
          <span className="text-faint">Never more than you allow.</span>
        </h1>
        <p className="m-0 max-w-[520px] text-lg leading-[1.6] text-fg-soft">
          One MCP connection to find paid tools, hear the exact price before anything is signed, and pay per call in
          USDC on Stellar. Every purchase comes back with an on-chain receipt.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="#connect" className={`${cta} h-[52px] gap-2.5 rounded-[14px] px-[22px] text-base`}>
            Connect your agent
            <span className="font-mono text-[12.5px] opacity-60">toolport router</span>
          </a>
          <Link href="/catalog" className={`${ghost} h-[52px] rounded-[14px] px-[22px] text-base`}>
            Browse the catalog
          </Link>
        </div>
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-[22px] gap-y-2 p-0 text-sm text-fg-soft">
          <li>No API keys</li>
          <li>No subscriptions</li>
          <li>No XLM needed for fees</li>
        </ul>
      </div>

      <figure
        aria-label="A conversation: the agent asks, Toolport quotes and pays, the agent answers"
        className="m-0 flex min-w-0 flex-[1_1_460px] flex-col gap-3.5 rounded-[26px] border border-line bg-panel p-4 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.6)] sm:p-[22px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-selected pb-1.5 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-[7px]">
            <span className="h-[7px] w-[7px] rounded-full bg-good" />
            Claude · connected to Toolport
          </span>
          <span className="font-mono">$0.979 of $1.00 left</span>
        </div>
        <div
          className="tpx-in max-w-[80%] self-end rounded-[18px_18px_6px_18px] bg-bubble px-4 py-3 text-[15px] leading-[1.45]"
          style={{ animationDelay: ".4s" }}
        >
          What&apos;s the best way to swap 100 XLM for USDC right now?
        </div>
        <div className="tpx-in flex items-center gap-2 font-mono text-xs text-muted" style={{ animationDelay: "1s" }}>
          <span>toolport.search</span>
          <span className="text-[#6E6A60]">→</span>
          <span>dex_best_path</span>
        </div>
        <div
          className="tpx-in flex flex-col gap-2.5 rounded-2xl border border-line bg-raised px-4 py-3.5"
          style={{ animationDelay: "1.5s" }}
        >
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted">Quote</span>
            <span className="font-mono text-sm font-medium">dex_best_path</span>
            <span className="text-[13px] text-muted">Stellar Oracle</span>
            <span className="ml-auto text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums">$0.02</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-accent">
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0"
            >
              <path d="M8 1.5 2.5 4v4c0 3.2 2.4 5.6 5.5 6.5 3.1-.9 5.5-3.3 5.5-6.5V4z" />
              <path d="m5.5 8 1.8 1.8L10.5 6.5" />
            </svg>
            Under your $0.05 per-call cap. Checked before signing.
          </div>
        </div>
        <div
          className="tpx-in flex flex-wrap items-center gap-3 rounded-2xl bg-[#1F2B24] px-4 py-3.5 text-[13.5px]"
          style={{ animationDelay: "2.2s" }}
        >
          <span className="h-[9px] w-[9px] rounded-full bg-good" />
          <span>
            Paid <strong className="font-mono font-medium">$0.02</strong> USDC. Settled on Stellar.
          </span>
          <Ext href={txUrl(HERO_TX)} className="ml-auto font-mono text-[12.5px] text-accent hover:text-fg">
            {shortHash(HERO_TX)} ↗
          </Ext>
        </div>
        <div className="tpx-in px-0.5 pt-1 text-lg leading-normal tracking-[-0.01em]" style={{ animationDelay: "2.8s" }}>
          Route it through XLM → USDC: 100 XLM gets you <strong className="font-semibold">87.46 USDC</strong>, at a rate
          of 0.8746.
        </div>
        <div aria-hidden="true" className="flex gap-1 pl-0.5">
          {[0, 0.2, 0.4].map((d) => (
            <span key={d} className="tpx-dot h-[5px] w-[5px] rounded-full bg-faint" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </figure>
    </Section>
  );
}

const GUARANTEES = [
  ["The price, before anything is signed.", "Over-cap calls are refused with no transaction."],
  ["A budget that holds.", "Across restarts and parallel calls. Unknown outcomes stay held."],
  ["Never paid twice.", "The same request returns the stored result."],
  ["A receipt for every call.", "Verified on-chain, linked to Stellar Expert."],
];

export function Guarantees() {
  return (
    <Section label="What the agent can count on" className="py-6">
      <ul className="m-0 grid list-none gap-6 border-t border-line p-0 pt-6 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {GUARANTEES.map(([title, body]) => (
          <li key={title} className="flex flex-col gap-1.5">
            <span className="text-[17px] font-semibold tracking-[-0.025em]">{title}</span>
            <span className="text-sm leading-normal text-muted">{body}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
