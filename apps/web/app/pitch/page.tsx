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

// The Hack Meridian pitch, as a page. The template's order (title, PMF, solution, technical workflow,
// team) with the detail in between: who it is for, connecting, safety, selling, catalog, proof, roadmap.
const PROOF_TX = "b3168b851ff33fc7cd7f64d1ef336bafa2187c64c5747cf39bcb99bc5e6efb76";
const STEPS = 13;

export default function PitchPage() {
  return (
    <main className="bg-ink text-fg">
      <Deck
        slides={[
          { id: "title", next: "The problem", content: <Title /> },
          { id: "pmf", next: "Who it's for", content: <Pmf /> },
          { id: "users", next: "The solution", content: <Users /> },
          { id: "solution", next: "Connect an agent", content: <Solution /> },
          { id: "connect", next: "Technical workflow", content: <Connect /> },
          { id: "workflow", next: "Under the hood", content: <Workflow /> },
          { id: "payment", next: "Safety", content: <Payment /> },
          { id: "safety", next: "For sellers", content: <Safety /> },
          { id: "sellers", next: "The catalog", content: <Sellers /> },
          { id: "catalog", next: "Architecture", content: <Catalog /> },
          { id: "architecture", next: "Proof", content: <Architecture /> },
          { id: "proof", next: "Roadmap", content: <Proof /> },
          { id: "roadmap", next: "The team", content: <Roadmap /> },
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
          Pitch step {String(step).padStart(2, "0")} / {String(STEPS).padStart(2, "0")}
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
        <Link href="/#connect" className="ml-auto rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-ink hover:bg-white">
          Connect your agent
        </Link>
      </div>
    </div>
  );
}

function Solution() {
  return (
    <Frame
      step={3}
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
          "It works in the agents people already use: Claude Code, Cursor, Codex, Claude Desktop.",
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
      step={1}
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
          "Subscriptions don't fit agents: they need one call to one tool, now, for a cent.",
          "Tool makers have no way to charge an agent, so useful MCP servers stay free or closed.",
        ]}
      />
      <Callout label="Toolport:">x402 makes calls payable; we make paying safe for agents.</Callout>
    </Frame>
  );
}

function Workflow() {
  const steps = [
    ["Search", "Toolport registry and curated manifests"],
    ["Quote", "Exact price, checked against the caps"],
    ["Sign", "One USDC authorization, nothing more"],
    ["Run", "Payment verified, the tool runs"],
    ["Settle", "Settled on Stellar"],
    ["Receipt", "Answer plus a Stellar Expert link"],
  ];
  return (
    <Frame
      step={5}
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
          "The router searches the Toolport registry and curated manifests over one MCP connection.",
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
  const team: { name: string; role: string; built: string; link?: string }[] = [
    {
      name: "Nam Lap Vu",
      role: "Backend engineer · Go",
      built: "Payments core and the x402 MCP SDK, the gateway, the CLI and the router's paid calls.",
      link: "https://www.linkedin.com/in/nam-lap-vu-b37a53266/",
    },
    {
      name: "Konstantin Kokaimov",
      role: "Engineer",
      built: "Discovery router, durable payments and budget holds, ecosystem research and the MPP Router catalog.",
      link: "https://www.linkedin.com/in/kokaimov",
    },
    {
      name: "Anastasiia Hlushchenko",
      role: "UI/UX designer",
      built: "The Toolport brand, logo and motion, the site, the catalog and this deck.",
    },
  ];
  return (
    <Frame
      step={13}
      title="The team"
      lead="Three people who built Toolport end to end in one hackathon."
      aside={
        <ul className="space-y-3">
          {team.map((m) => (
            <li key={m.name} className="flex gap-4 rounded-2xl border border-line bg-panel p-5">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-selected text-lg font-semibold uppercase"
              >
                {m.name[0]}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-semibold">{m.name}</span>
                  <span className="font-mono text-xs text-good">{m.role}</span>
                </span>
                <span className="mt-1 block text-sm leading-snug text-fg-soft">{m.built}</span>
                {m.link && (
                  <a href={m.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-accent hover:text-fg">
                    LinkedIn ↗
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      }
    >
      <Points
        items={[
          "Backend: payments and protocol, x402 on Stellar from the SDK to the gateway.",
          "Product: budgets that hold across restarts, refusals before signing, a catalog of 448 paid APIs.",
          "Design: one visual language across the site, the catalog, the loaders and the pitch.",
          "Open by design: any MCP server can list, built on open standards.",
        ]}
      />
      <Callout label="Built with:">Stellar, x402, OpenZeppelin and MCP.</Callout>
    </Frame>
  );
}

function Cards({ items, cols = "sm:grid-cols-2" }: { items: [string, ReactNode][]; cols?: string }) {
  return (
    <ul className={`grid gap-3 ${cols}`}>
      {items.map(([name, body]) => (
        <li key={name} className="rounded-2xl border border-line bg-panel p-4">
          <p className="font-semibold">{name}</p>
          <p className="mt-1 text-sm leading-snug text-muted">{body}</p>
        </li>
      ))}
    </ul>
  );
}

function Users() {
  return (
    <Frame
      step={2}
      title="Who it's for"
      lead="Two sides of one market: agents that buy, tools that sell."
      aside={
        <Cards
          cols=""
          items={[
            ["Agent users", "Developers running Claude Code, Cursor, Codex or their own agents, who want live data and paid APIs without managing keys."],
            ["Agent builders", "Teams shipping agents that must pay for tools on behalf of their users, with a spend limit they can prove."],
            ["Tool sellers", "Owners of MCP servers and APIs who want per-call revenue without accounts, billing or chargebacks."],
          ]}
        />
      }
    >
      <Points
        items={[
          "Agents already call tools all day; what's missing is a way to pay that a person can trust.",
          "Sellers get a market from day one: any agent with a Toolport wallet can buy their tool.",
          "Stellar fits: USDC settles in seconds for a fraction of a cent, so a $0.001 call makes sense.",
        ]}
      />
      <Callout label="Wedge:">developers' coding agents, which already speak MCP, need data the free web doesn't give them.</Callout>
    </Frame>
  );
}

function Connect() {
  const tools: [string, string][] = [
    ["search_tools", "Find tools across every source"],
    ["get_tool", "Schema and the exact quote"],
    ["probe_tool", "Check the price, pay nothing"],
    ["invoke_tool", "Pay under the caps and run"],
    ["get_run", "Look up a run by its id"],
    ["get_budget", "Spent, held and remaining"],
  ];
  return (
    <Frame
      step={4}
      title="Connect an agent"
      lead="One copy-paste prompt, and the agent sets itself up."
      aside={
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted">Router MCP tools</p>
          <ul className="grid grid-cols-2 gap-3">
            {tools.map(([name, body]) => (
              <li key={name} className="rounded-2xl border border-line bg-panel p-4">
                <p className="font-mono text-sm text-fg">{name}</p>
                <p className="mt-1 text-xs leading-snug text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <Points
        items={[
          <>The site's <strong className="text-fg">Copy setup prompt</strong> button gives the agent everything: clone, install the CLI, create a testnet wallet with test USDC.</>,
          <>In Claude Code it installs the <strong className="text-fg">Toolport plugin</strong>: the router MCP server plus a skill that teaches the buy flow and every refusal.</>,
          "Any other MCP client (Cursor, Claude Desktop, Codex) adds one stdio server: toolport router.",
          "The router keeps running without a wallet and asks for one only on the first paid call.",
        ]}
      />
      <Callout label="House rules:">the agent asks before its first paid call and never prints the wallet secret.</Callout>
    </Frame>
  );
}

function Payment() {
  const steps: [string, string][] = [
    ["Agent → gateway", "tools/call without payment"],
    ["Gateway → agent", "x402 quote: price, asset, payTo, network"],
    ["Router", "Checks the per-call cap and the session budget, then holds the amount"],
    ["Wallet", "Signs a Soroban auth entry for one USDC transfer"],
    ["Facilitator", "OpenZeppelin verifies it; the gateway runs the upstream tool"],
    ["Settle", "Facilitator submits and pays the fee; the hold becomes spend"],
  ];
  return (
    <Frame
      step={6}
      title="Under the hood"
      lead="x402 over MCP, settled in USDC on Stellar."
      aside={
        <ol className="space-y-2">
          {steps.map(([who, what], i) => (
            <li key={who} className="flex gap-4 rounded-2xl border border-line bg-panel px-4 py-3">
              <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="block text-sm font-semibold">{who}</span>
                <span className="block text-xs leading-snug text-muted">{what}</span>
              </span>
            </li>
          ))}
        </ol>
      }
    >
      <Points
        items={[
          "Built on the official x402 packages (@x402/stellar, @x402/mcp) and the x402 MCP transport spec.",
          "The payment is an authorization for one exact transfer, not an allowance: the agent can't be charged twice.",
          "The facilitator pays the network fee, so the agent's wallet needs only USDC, never XLM.",
          "The buyer checks the quote it pays: exact scheme, Stellar network, USDC, the amount and payee it was shown.",
        ]}
      />
      <Callout label="Standards, not lock-in:">any x402 client can pay a Toolport tool, and the router can pay any x402 API.</Callout>
    </Frame>
  );
}

function Safety() {
  return (
    <Frame
      step={7}
      title="Safety"
      lead="Every guard runs before anything is signed."
      aside={
        <Cards
          items={[
            ["Per-call cap", "A price above the cap is refused. The default is $0.05."],
            ["Session budget", "A total for the session, stored on disk: restarts don't reset it."],
            ["Holds", "Each payment reserves its amount first, so parallel calls can't overspend."],
            ["Idempotency keys", "Repeating a request returns the stored run instead of paying again."],
            ["Unknown outcomes", "If settlement is unclear, the amount stays held and nothing retries on its own."],
            ["Hardened gateway", "No redirects, no private upstreams, 1 MB request limit, signed sessions."],
          ]}
        />
      }
    >
      <Points
        items={[
          "An agent's mistake costs at most one capped call; a runaway loop hits the budget and stops.",
          "Every outcome has a status and a reason the agent can read: refused, completed, provider_error, payment_unknown.",
          "Every paid call ends with a receipt: the result plus a Stellar Expert transaction link.",
        ]}
      />
      <Callout label="Reviewed:">we ran a security review on the MVP and fixed what it found before shipping.</Callout>
    </Frame>
  );
}

function Sellers() {
  return (
    <Frame
      step={8}
      title="For sellers"
      lead="List an MCP server, set a price per tool, get paid per call."
      aside={
        <ol className="grid gap-3 sm:grid-cols-2">
          {[
            ["Sign in", "With Freighter: one signed message (SEP-53), no account or email."],
            ["Register", "Paste the server's MCP URL; the gateway reads its tools."],
            ["Price", "Set a USDC price per tool, from $0.001, or leave it free."],
            ["Earn", "Each paid call settles to the seller's Stellar address."],
          ].map(([name, body], i) => (
            <li key={name} className="rounded-2xl border border-line bg-panel p-4">
              <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-2 font-semibold">{name}</p>
              <p className="mt-1 text-xs leading-snug text-muted">{body}</p>
            </li>
          ))}
        </ol>
      }
    >
      <Points
        items={[
          "The upstream server doesn't change: the gateway sits in front, charges, and forwards the call.",
          "The tool only runs once the payment is verified; settlement follows the result.",
          "Listings show up in the public catalog and in every agent's search_tools.",
        ]}
      />
      <Callout label="No billing stack:">no invoices, no card processor, no chargebacks.</Callout>
    </Frame>
  );
}

function Catalog() {
  const categories: [string, number][] = [
    ["Data", 196],
    ["AI", 125],
    ["Social", 49],
    ["Web", 27],
    ["Blockchain", 21],
    ["Search", 15],
  ];
  return (
    <Frame
      step={9}
      title="The catalog"
      lead="448 paid APIs on day one, plus our own testnet tools."
      aside={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-panel p-4">
              <p className="text-4xl font-semibold tracking-[-0.04em]">448</p>
              <p className="mt-1 text-xs text-muted">MPP Router APIs, Stellar mainnet</p>
            </div>
            <div className="rounded-2xl border border-line bg-panel p-4">
              <p className="text-4xl font-semibold tracking-[-0.04em]">27</p>
              <p className="mt-1 text-xs text-muted">with a verified paid run</p>
            </div>
          </div>
          <ul className="space-y-2 rounded-2xl border border-line bg-panel p-4">
            {categories.map(([name, count]) => (
              <li key={name} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-fg-soft">{name}</span>
                <span className="h-2 rounded-full bg-good" style={{ width: `${(count / 196) * 60}%` }} />
                <span className="font-mono text-xs text-muted">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <Points
        items={[
          "Stellar Oracle on testnet: dex_best_path ($0.02), account_summary ($0.01) and a free ping.",
          "MPP Router's whole payable catalog: search, LLMs, market data, maps, scraping, email and more.",
          "One search_tools call covers the registry and every manifest; prices come with the results.",
        ]}
      />
      <Callout label="Mainnet-ready:">the same router pays MPP Router APIs with real USDC on stellar:pubnet.</Callout>
    </Frame>
  );
}

function Architecture() {
  const parts: [string, string][] = [
    ["toolport router", "Local discovery MCP: search, quote, caps, budget, durable runs"],
    ["@stellarpay/core", "Payments: x402 schemes, facilitator, budget store, USDC units"],
    ["@stellarpay/mcp", "x402 MCP client and server wrappers"],
    ["Gateway", "Hono + SQLite: registry, pricing, paid proxy, SEP-53 auth"],
    ["Web", "Next.js: landing, catalog, seller dashboard, this deck"],
    ["Claude Code plugin", "The router as an MCP server, plus the Toolport skill"],
  ];
  return (
    <Frame
      step={10}
      title="Architecture"
      lead="Agent → router → gateway → tool, with Stellar under every paid hop."
      aside={<Cards items={parts} />}
    >
      <Points
        items={[
          "The wallet and the budget live on the user's machine; the gateway never holds a buyer key.",
          "The gateway is stateless about money: the facilitator verifies and settles on-chain.",
          "Ships as three Docker images (web, gateway, demo server) behind one Compose file.",
          "TypeScript end to end, unit-tested, plus Playwright runs that pay on testnet for real.",
        ]}
      />
      <Callout label="Open source:">github.com/HackatonWinnners/toolport</Callout>
    </Frame>
  );
}

function Proof() {
  return (
    <Frame
      step={11}
      title="Proof"
      lead="It runs today, on Stellar testnet."
      aside={
        <div className="grid grid-cols-2 gap-3">
          {[
            ["4.5–9 s", "a paid call, end to end"],
            ["$0.02", "dex_best_path, settled in USDC"],
            ["0 XLM", "needed in the agent's wallet"],
            ["448 + 3", "paid tools the router can find"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-line bg-panel p-4">
              <p className="text-3xl font-semibold tracking-[-0.04em]">{value}</p>
              <p className="mt-1 text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
      }
    >
      <Points
        items={[
          <>Web app and catalog: <a href="https://toolport.042067.xyz" className="text-accent hover:text-fg">toolport.042067.xyz</a></>,
          <>Gateway and the paid Stellar Oracle MCP endpoint: <span className="font-mono text-sm">api.toolport.042067.xyz</span></>,
          "Our end-to-end tests make real paid calls against testnet and check the receipt on-chain.",
        ]}
      />
      <Callout label="A real receipt:">
        <a href={txUrl(PROOF_TX)} target="_blank" rel="noreferrer" className="font-mono text-accent hover:text-fg">
          b3168b85… ↗
        </a>{" "}
        on Stellar Expert.
      </Callout>
    </Frame>
  );
}

function Roadmap() {
  return (
    <Frame
      step={12}
      title="Roadmap"
      lead="From the hackathon MVP to a mainnet market."
      aside={
        <Cards
          cols=""
          items={[
            ["Next", "Mainnet registry, the CLI on npm, the browser playground and activity page back on."],
            ["Then", "Spending policies per tool and per seller, team wallets, alerts on holds."],
            ["Later", "More registries in one search, seller analytics, payouts in other Stellar assets."],
          ]}
        />
      }
    >
      <Points
        items={[
          "Revenue: a small fee on each settled call, taken by the gateway.",
          "Growth: every seller who lists brings tools; every tool brings agents.",
          "Ecosystem: built on x402 and MCP, so we grow with both standards.",
        ]}
      />
      <Callout label="The ask:">try it with your agent and list your tool.</Callout>
    </Frame>
  );
}
