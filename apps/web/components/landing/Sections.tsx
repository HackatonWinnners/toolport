import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { StatusDot } from "@/components/brand/StatusDot";
import { CopyButton } from "@/components/ui";
import { DOCS_URL, FAUCET_URL, routerConfig, txUrl } from "@/lib/api";
import { HowItWorks } from "./HowItWorks";
import { PROOF, shortHash } from "./proof";
import { Ext, H2, JsonTinted, Pill, Section, cta, ghost } from "./parts";

export function How() {
  return (
    <Section id="how" labelledBy="how-h" className="flex flex-col gap-10 pb-10 pt-20 sm:pt-28">
      <div className="flex max-w-[720px] flex-col gap-3.5">
        <H2 id="how-h">Six steps, about ten seconds, one receipt.</H2>
        <p className="m-0 text-[17px] leading-[1.6] text-fg-soft">
          Your agent never sees a key or a checkout page. It asks, gets a price, and Toolport handles the rest inside
          the limits you set.
        </p>
      </div>
      <HowItWorks />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line-strong px-[18px] py-4 text-sm text-fg-soft">
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          stroke="var(--color-fg)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <path d="M10 2 3.5 4.8v4.6c0 3.8 2.8 6.6 6.5 7.6 3.7-1 6.5-3.8 6.5-7.6V4.8z" />
          <path d="M7 10h6" />
        </svg>
        <span className="min-w-0 flex-1">
          <strong className="font-semibold text-fg">Over the cap?</strong> It stops at step 02. Nothing is signed and no
          transaction is sent.
        </span>
      </div>
    </Section>
  );
}

export function Proof() {
  const cell = "px-5 py-4";
  return (
    <Section id="proof" labelledBy="proof-h" className="flex flex-col gap-8 pb-10 pt-20 sm:pt-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <H2 id="proof-h" className="max-w-[640px]">
          Don&apos;t take our word for it. Open the receipts.
        </H2>
        <span className="max-w-[360px] text-[15px] leading-normal text-muted">
          Real payments on Stellar testnet. Refusals and repeats are logged too.
        </span>
      </div>
      <div className="overflow-x-auto rounded-[20px] border border-line bg-panel">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              {["Status", "Amount", "Tool", "What happened"].map((h) => (
                <th key={h} scope="col" className="border-b border-line px-5 py-3.5 font-medium">
                  {h}
                </th>
              ))}
              <th scope="col" className="border-b border-line px-5 py-3.5 text-right font-medium">
                Transaction
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr:not(:last-child)>td]:border-b [&>tr>td]:border-selected">
            {PROOF.map((row, i) => (
              <tr key={i} data-testid="proof-row" className={row.tx ? "" : "bg-sunken"}>
                <td className={cell}>
                  <span className="inline-flex items-center gap-2">
                    {row.dot === "stored" ? (
                      <span aria-hidden="true" className="inline-block h-[9px] w-[9px] rounded-full bg-[#6E6A60]" />
                    ) : (
                      <StatusDot status={row.dot} />
                    )}
                    {row.status}
                  </span>
                </td>
                <td className={`${cell} font-mono`}>{row.amount}</td>
                <td className={cell}>
                  <span className={row.mono ? "font-mono" : ""}>{row.tool}</span>{" "}
                  <span className="text-muted">· {row.source}</span>
                </td>
                <td className={`${cell} text-fg-soft`}>{row.what}</td>
                <td className={`${cell} text-right`}>
                  {row.tx ? (
                    <Ext href={txUrl(row.tx)} className="font-mono text-[13px] text-accent hover:text-fg">
                      {shortHash(row.tx)} ↗
                    </Ext>
                  ) : (
                    <span className="text-[13px] text-muted">{row.note}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// Registry tools come from apps/demo-server (Stellar Oracle).
const CATALOG = [
  { name: "dex_best_path", mono: true, price: "$0.02", body: "Best swap path between two Stellar assets.", tags: ["Stellar Oracle", "Toolport registry", "MCP tool"] },
  { name: "account_summary", mono: true, price: "$0.01", body: "Balances and recent operations for a Stellar account.", tags: ["Toolport registry", "MCP tool"] },
  { name: "ping", mono: true, price: "free", body: "Check the server is reachable. Costs nothing.", tags: ["Toolport registry", "MCP tool"] },
];

export function Catalog() {
  return (
    <Section id="catalog" labelledBy="cat-h" className="flex flex-col gap-8 pb-10 pt-20 sm:pt-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-[640px] flex-col gap-3.5">
          <H2 id="cat-h">Tools from a cent a call.</H2>
          <p className="m-0 text-[17px] leading-[1.6] text-fg-soft">
            The Toolport registry, plus 448 paid APIs from MPP Router on Stellar mainnet: search, LLMs, market data
            and more. One connection, the price before every call.
          </p>
        </div>
        <Link href="/catalog" className={`${ghost} h-11 px-[18px] text-[15px]`}>
          Browse all tools
        </Link>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        {CATALOG.map((tool) => (
          <li key={tool.name}>
            <Link
              href="/catalog"
              data-testid="catalog-card"
              className="box-border flex h-full flex-col gap-3 rounded-[18px] border border-line bg-panel p-5 text-fg no-underline transition-colors hover:border-[#4A473F]"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className={`text-[15px] font-medium ${tool.mono ? "font-mono" : ""}`}>{tool.name}</span>
                <span className="text-xl font-semibold tracking-[-0.03em]">{tool.price}</span>
              </span>
              <span className="text-sm leading-normal text-fg-soft">{tool.body}</span>
              <span className="mt-auto flex flex-wrap gap-1.5 text-xs text-muted">
                {tool.tags.map((t) => (
                  <Pill key={t}>{t}</Pill>
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const PAID_TOOL = `server.paidTool("dex_best_path", "Best DEX path between two assets", "$0.02", schema, handler)`;

export function Sellers() {
  const p = (s: string) => <span className="text-muted">{s}</span>;
  const q = (s: string) => <span className="text-held">{s}</span>;
  return (
    <Section id="sell" labelledBy="sell-h" className="pb-10 pt-20 sm:pt-28">
      <div className="flex flex-col gap-8 rounded-[28px] border border-line bg-panel p-[clamp(20px,4vw,48px)]">
        <div className="flex flex-wrap justify-between gap-8">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5">
            <h2
              id="sell-h"
              className="m-0 text-[clamp(30px,3.6vw,46px)] font-semibold leading-[1.05] tracking-[-0.045em]"
            >
              Already run an MCP server? Get paid per call.
            </h2>
            <p className="m-0 text-[17px] leading-[1.6] text-fg-soft">
              Set a price per tool and get paid in USDC on Stellar. Agents find you through the catalog and see your
              price before they buy.
            </p>
            <div className="flex flex-wrap gap-3 pt-1.5">
              <Link href="/dashboard" className={`${cta} h-12 px-5 text-[15px]`}>
                List your server
              </Link>
              {DOCS_URL && (
                <Ext href={DOCS_URL} className={`${ghost} h-12 px-5 text-[15px]`}>
                  Seller docs
                </Ext>
              )}
            </div>
          </div>
          <ol className="m-0 flex min-w-0 flex-[1_1_360px] list-none flex-col gap-0.5 p-0 text-[15px]">
            {[
              "Paste your MCP URL. We discover its tools.",
              "Set a price per tool, from $0.001.",
              "Choose a payout address. We check its USDC trustline.",
              "Get your paid URL. Revenue and calls show up live.",
            ].map((s, i, all) => (
              <li key={s} className={`flex gap-3.5 py-3 ${i < all.length - 1 ? "border-b border-line" : ""}`}>
                <span className="pt-[3px] font-mono text-xs text-muted">0{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-fg-soft">Or monetize from code, with one line:</span>
            <CopyButton value={PAID_TOOL} />
          </div>
          <pre className="m-0 overflow-x-auto whitespace-pre rounded-2xl border border-selected bg-[#141311] px-[22px] py-5 font-mono text-[14.5px] leading-[1.6] text-fg">
            server.<span className="text-accent">paidTool</span>
            {p("(")}
            {q('"dex_best_path"')}
            {p(",")} {q('"Best DEX path between two assets"')}
            {p(",")} {q('"$0.02"')}
            {p(",")} schema{p(",")} handler{p(")")}
          </pre>
        </div>
      </div>
    </Section>
  );
}

export function BuiltWith() {
  return (
    <Section labelledBy="built-h" className="flex flex-col items-center gap-5 pb-6 pt-24 text-center">
      <h2 id="built-h" className="m-0 text-[15px] font-normal text-muted">
        Built with
      </h2>
      <ul className="m-0 flex list-none flex-wrap justify-center gap-x-[clamp(24px,5vw,64px)] gap-y-3 p-0 text-2xl font-semibold tracking-[-0.04em] text-fg-soft">
        {["Stellar", "x402", "OpenZeppelin", "MCP"].map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </Section>
  );
}

const FAQ: [string, ReactNode][] = [
  [
    "Can my agent spend more than I allow?",
    "No. You set a total budget and a per-call cap. The price is checked before anything is signed, over-cap calls are refused with no transaction, and the budget holds across restarts and parallel calls.",
  ],
  [
    "What if a payment's outcome is unknown?",
    "It stays held: counted against your budget, never treated as free. You can check it on-chain later.",
  ],
  ["Will I pay twice for the same request?", "No. Repeating the same request returns the stored result instead of paying again."],
  [
    "Do I need XLM, API keys or a subscription?",
    "No. Your agent pays per call in USDC. There's no XLM to hold for fees, no keys to manage and no plan to sign up for.",
  ],
  [
    "Where do the tools come from?",
    "From the Toolport registry: any MCP server a seller lists, priced per tool. One MCP connection covers all of them.",
  ],
  [
    "Is this real money?",
    <>
      Not yet. Toolport runs on Stellar testnet with test USDC. Get some from the{" "}
      <Ext href={FAUCET_URL} className="text-accent hover:text-fg">
        testnet faucet
      </Ext>
      .
    </>,
  ],
];

export function Faq() {
  return (
    <section
      aria-labelledby="faq-h"
      className="mx-auto box-border flex w-full max-w-[860px] flex-col gap-7 px-4 pb-10 pt-20 sm:px-6 sm:pt-28"
    >
      <H2 id="faq-h">Questions</H2>
      <div className="flex flex-col border-t border-line">
        {FAQ.map(([q, a], i) => (
          <details key={q} data-testid="faq-item" open={i === 0} className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-medium tracking-[-0.02em] [&::-webkit-details-marker]:hidden">
              {q}
              <span
                aria-hidden="true"
                className="text-[22px] font-normal text-muted transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <p className="m-0 mb-5 max-w-[680px] text-base leading-[1.6] text-fg-soft">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Closing() {
  const config = routerConfig();
  // Shown with the args on one line, as on the board; Copy still gets routerConfig() verbatim.
  const shown = config.replace(/\[\s*([^[\]]*?)\s*\]/g, (_, inner: string) => `[${inner.split(/,\s*\n\s*/).join(", ")}]`);
  return (
    <Section id="connect" labelledBy="cta-h" className="flex flex-col items-center gap-10 pb-24 pt-24 sm:pt-[120px]">
      <div className="tpx-scroll flex flex-col items-center gap-6 text-center">
        <LogoMark size={140} ringClass={{ a: "tpl-A", b: "tpl-B", link: "tpl-L" }} />
        <h2 id="cta-h" className="m-0 text-[clamp(36px,5vw,64px)] font-semibold leading-none tracking-[-0.05em]">
          Plug your agent in.
        </h2>
        <p className="m-0 text-[17px] text-fg-soft">
          Give your agent one config block and it can find, price and pay for tools on its own.
        </p>
      </div>
      <div className="flex w-full flex-wrap gap-4">
        <div className="flex min-w-0 flex-[1.4_1_420px] flex-col gap-3.5 rounded-[22px] border border-line bg-panel p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xl font-semibold tracking-[-0.03em]">Connect your agent</span>
            <CopyButton value={config} />
          </div>
          <p className="m-0 text-[15px] leading-[1.6] text-fg-soft">
            Add this to Claude Desktop or Cursor. $1 budget, $0.05 per call.
          </p>
          <pre
            data-testid="connect-config"
            className="m-0 overflow-x-auto whitespace-pre rounded-[14px] border border-selected bg-[#141311] px-[18px] py-4 font-mono text-[13.5px] leading-[1.65] text-fg"
          >
            <JsonTinted json={shown} />
          </pre>
        </div>
      </div>
    </Section>
  );
}
