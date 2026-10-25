import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { StatusDot } from "@/components/brand/StatusDot";
import { Deck } from "@/components/pitch/Deck";
import { txUrl } from "@/lib/api";

export const metadata: Metadata = {
  title: "Toolport · Pitch",
  description: "Toolport at Hack Meridian 2026: your agent can buy the tools it needs, never more than you allow.",
};

// The Hack Meridian pitch, as a page: title, solution, PMF, technical workflow, team.
const PROOF_TX = "b3168b851ff33fc7cd7f64d1ef336bafa2187c64c5747cf39bcb99bc5e6efb76";

export default function PitchPage() {
  return (
    <main className="bg-ink text-fg">
      <Deck
        slides={[
          { id: "title", next: "The solution", content: <Title /> },
          { id: "solution", next: "PMF", content: <Solution /> },
          { id: "pmf", next: "Technical workflow", content: <Pmf /> },
          { id: "workflow", next: "The team", content: <Workflow /> },
          { id: "team", content: <Team /> },
        ]}
      />
    </main>
  );
}

function Frame({ step, title, lead, children, aside }: { step: number; title: string; lead: string; children: ReactNode; aside: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div>
        <span className="inline-block rounded-full border border-good-line px-3 py-1 font-mono text-xs text-good">
          Pitch step {String(step).padStart(2, "0")} / 04
        </span>
        <h2 className="mt-5 text-[clamp(44px,7vw,96px)] font-semibold leading-[0.95] tracking-[-0.05em]">{title}</h2>
        <p className="mt-6 text-[clamp(20px,2vw,26px)] font-medium tracking-[-0.02em]">{lead}</p>
        <div className="mt-6">{children}</div>
      </div>
      <div>{aside}</div>
    </div>
  );
}

function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3 text-[17px] leading-relaxed text-fg-soft">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[3px] text-good">▸</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="mt-8 rounded-2xl border border-good-line bg-panel px-5 py-4 text-[17px] text-fg-soft">
      <strong className="font-semibold text-fg">{label}</strong> {children}
    </p>
  );
}

function Title() {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">Hack Meridian 2026 · Lisbon</p>
      <div className="mt-10 flex flex-wrap items-center gap-6">
        <LogoMark size={110} />
        <h1 className="text-[clamp(64px,12vw,160px)] font-semibold leading-[0.9] tracking-[-0.06em]">toolport</h1>
      </div>
      <p className="mt-8 max-w-3xl text-[clamp(26px,3.4vw,44px)] font-semibold leading-[1.1] tracking-[-0.04em]">
        Your agent can buy the tools it needs. <span className="text-muted">Never more than you allow.</span>
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-line-strong px-3 py-1 font-mono text-xs text-fg-soft">Paid tools for AI agents</span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-held" /> Live on Stellar testnet
        </span>
        <Link href="/playground" className="ml-auto rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-ink hover:bg-white">
          Try it in the browser
        </Link>
      </div>
    </div>
  );
}

function Solution() {
  return (
    <Frame
      step={1}
      title="The solution"
      lead="One MCP connection to buy any paid tool."
      aside={
        <figure className="rounded-[20px] border border-line bg-panel p-5">
          <figcaption className="font-mono text-xs text-muted">toolport.search → dex_best_path</figcaption>
          <div className="mt-4 rounded-2xl border border-line bg-raised p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">Quote</span>
              <span className="text-2xl font-semibold tracking-[-0.03em]">$0.02</span>
            </div>
            <p className="mt-1 font-mono text-sm">dex_best_path · Stellar Oracle</p>
            <p className="mt-2 text-sm text-good">Under your $0.05 per-call cap. Nothing signed yet.</p>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-fg-soft">
            <StatusDot status="settled" /> Paid $0.02 USDC. Settled on Stellar.
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-fg-soft">
            <StatusDot status="refused" /> Over the cap? Refused. Nothing signed.
          </p>
        </figure>
      }
    >
      <Points
        items={[
          "The agent finds a tool and hears the exact price before anything is signed.",
          "It pays per call in USDC on Stellar via x402: no API keys, no subscriptions.",
          "Hard caps: over-budget calls are refused, and every purchase has a receipt.",
        ]}
      />
      <Callout label="Two-sided:">sellers list any MCP server and get paid per call, from $0.001.</Callout>
    </Frame>
  );
}

function Pmf() {
  const rows: [string, string][] = [
    ["Sign up, get a key, pick a plan", "One config block, no keys"],
    ["Card or key: spend has no ceiling", "Total and per-call caps, refused before signing"],
    ["Invoices at the end of the month", "A Stellar transaction for every call"],
    ["Tools stay free or closed", "Any MCP server can charge per call"],
  ];
  return (
    <Frame
      step={2}
      title="PMF"
      lead="AI agents can't safely pay for the tools they need."
      aside={
        <div className="overflow-hidden rounded-[20px] border border-line">
          <div className="grid grid-cols-2 bg-sunken px-5 py-3 font-mono text-xs text-muted">
            <span>Today</span>
            <span>With Toolport</span>
          </div>
          {rows.map(([today, ours]) => (
            <div key={today} className="grid grid-cols-2 gap-4 border-t border-line bg-panel px-5 py-4 text-sm">
              <span className="text-muted">{today}</span>
              <span className="text-fg">{ours}</span>
            </div>
          ))}
        </div>
      }
    >
      <Points
        items={[
          "Paid APIs want a signup, a key and a subscription: they are built for humans.",
          "Handing an agent a card or an API key means unlimited spend and no audit trail.",
        ]}
      />
      <Callout label="Toolport:">x402 makes calls payable; we make paying safe for agents.</Callout>
    </Frame>
  );
}

function Workflow() {
  const steps = [
    ["Search", "Registry, manifests, Rail402's Bazaar"],
    ["Quote", "Exact price, checked against the caps"],
    ["Sign", "One USDC authorization, nothing more"],
    ["Run", "Payment verified, the tool runs"],
    ["Settle", "Settled on Stellar"],
    ["Receipt", "Answer plus a Stellar Expert link"],
  ];
  return (
    <Frame
      step={3}
      title="Technical workflow"
      lead="Search → quote → sign → run → settle → receipt."
      aside={
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {steps.map(([name, detail], i) => (
            <li key={name} className="rounded-2xl border border-line bg-panel p-4">
              <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-2 font-semibold">{name}</p>
              <p className="mt-1 text-xs leading-snug text-muted">{detail}</p>
            </li>
          ))}
        </ol>
      }
    >
      <Points
        items={[
          "The router searches our registry, curated manifests and Rail402's Bazaar over one MCP connection.",
          "The gateway prices each tool. An unpaid call returns an x402 quote; the wallet signs one USDC transfer, the tool runs, then it settles.",
        ]}
      />
      <Callout label="Live on testnet:">
        real paid calls in <span className="whitespace-nowrap">4.5–9 s</span> end to end,{" "}
        <a href={txUrl(PROOF_TX)} target="_blank" rel="noreferrer" className="font-mono text-accent hover:text-fg">
          b3168b85… ↗
        </a>
      </Callout>
    </Frame>
  );
}

function Team() {
  const team = [
    ["holeesheet", "Payments core, MCP SDK, gateway, CLI and web app"],
    ["Anastasiia", "Security hardening, budget holds, Rail402 Bazaar, design"],
    ["madvil2", "Discovery router, durable payments, ecosystem research"],
  ];
  return (
    <Frame
      step={4}
      title="The team"
      lead="Three builders who shipped it end to end."
      aside={
        <ul className="space-y-3">
          {team.map(([name, role]) => (
            <li key={name} className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-selected text-lg font-semibold uppercase"
              >
                {name[0]}
              </span>
              <span>
                <span className="block font-semibold">{name}</span>
                <span className="block text-sm text-muted">{role}</span>
              </span>
            </li>
          ))}
        </ul>
      }
    >
      <Points
        items={[
          "Payments and protocol: x402 on Stellar, from the SDK to the gateway.",
          "Product and safety: budgets that hold across restarts, refusals before signing.",
          "Ecosystem: discovery across Toolport and Rail402, built on open standards.",
        ]}
      />
      <Callout label="Built with:">Stellar, x402, OpenZeppelin, Rail402 and MCP.</Callout>
    </Frame>
  );
}
