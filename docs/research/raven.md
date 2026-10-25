# Raven vs StellarPay MCP

Checked 25 October 2026 against the public site and source: [raven.stellar.org](https://raven.stellar.org/), [ARCHITECTURE.md](https://github.com/stellar-experimental/stellar-raven/blob/main/ARCHITECTURE.md). Raven is linked from the HackMeridian build page and has a session today (RAVEN 101, 14:00), so judges will know it.

## What Raven is

SDF's remote MCP server for Stellar **context**: `https://raven.stellar.org/mcp`, OAuth sign-in (WorkOS), no service API keys.

- **Two tools.** `search` ranks about 60 operations and 20 playbooks over a 282-entry catalog (docs, 920+ ecosystem projects, 2,300+ graded repos, news, governance). `execute` runs model-written JavaScript in a networkless Cloudflare sandbox; every service call goes manifest entry → argument guard → adapter → normalized `{ ok, data | error }` envelope → secret redaction.
- **Free.** Raven has no payments, x402, USDC or budgets.

## How it relates to us

| | Raven | StellarPay MCP |
| --- | --- | --- |
| Job | What the agent *knows* about Stellar | What the agent can *buy*, with a budget |
| Catalog | Curated, generated in CI, checked daily against live services | Registry of paid MCP servers + manifest + Rail402 Bazaar |
| Entry points | `search`, `execute` (code mode) | `search_tools`, `get_tool`, `probe_tool`, `invoke_tool`, `get_run`, `get_budget` |
| Money | None | x402 USDC on Stellar, per-call cap, persistent budget, receipts |
| Auth | Remote MCP + OAuth | Local stdio router; the agent's wallet signs |

Not a competitor: they're complementary. Pitch line: *Raven tells your agent how Stellar works; StellarPay lets it pay for the tools it needs, under a budget.*

## What to borrow (small, high value)

1. **Cap what goes back into the model.** Raven cuts a result to about 6,000 tokens and keeps artifacts separately. Our router returns the whole run (up to 1 MB) from `invoke_tool`. Return a truncated preview and keep the full body in `get_run`; Frames does the same.
2. **One result envelope.** `{ ok: true, data }` / `{ ok: false, error: { kind } }` with caveats such as `no-rows`. Our router mixes provider JSON, run records and error strings.
3. **Search that says "no match".** Raven gates on token coverage and tags backfill hits; our lexical score returns weak matches as if they were good ones.

## Integration options

- **Use it while building (done).** `.mcp.json` in the repo adds Raven to Claude Code for everyone on the team. Run `/mcp` → Authenticate once.
- **Recommend it next to the router.** Agents get both servers: Raven for context, StellarPay for paid tools. No code needed.
- **Raven as a catalog source in our router.** It doesn't fit as-is: every call needs the user's own OAuth grant, and `execute` takes JavaScript rather than a typed tool call. Not worth it before the deadline.

## Checked with Raven (25 Oct, 14:20 UTC)

Raven was connected to Claude Code and used against this repo.

**Browser payment signer: fixed.** The official guide says Freighter's `signAuthEntry` returns "a Buffer of the signed hash" of the auth-entry preimage ([docs](https://developers.stellar.org/docs/build/guides/freighter/sign-auth-entries)), and the agentic-payments playbook warns a browser wallet needs "custom auth-entry signing" glue. stellar-sdk's `signAuthEntries` reads the result with `Buffer.from(signedAuthEntry, "base64")`, then verifies it against the payload. `apps/web/lib/buyer.ts` now converts Freighter's result (base64 string, `Uint8Array`, or serialized `{ type: "Buffer", data }`) to base64 and rejects anything that isn't a 64-byte signature.

**Confirmed as correct:** USDC SAC `CBIELTK6…DAMA` on testnet (the C address goes in requirements, while trustlines use the G issuer); `payTo` is a G account with a USDC trustline; OZ Channels needs an API key on testnet too. The x402.org facilitator (`https://x402.org/facilitator`) is a no-key testnet alternative.

**Prior art: the space is not empty** (Scout `hackathonBrief`, `searchProjects`). The pitch must say what's new, not "first".

| Project | What it is | Status (Scout) |
| --- | --- | --- |
| [TollPay](https://github.com/rajkaria/toll) | Middleware/SDKs to monetize MCP tools per call in USDC, mainnet. 5th place, Stellar Hacks: Agents | Live |
| [x402 MCP Stellar Template](https://github.com/ffarinas/x402-mcp-stellar-template) | Paid MCP server templates with spending limits. Winner, Stellar Hacks: Agents | Live |
| [Rail402](https://rail402.dev/) | Facilitator, Bazaar catalog of paid endpoints/MCP tools, MCP server for agents to find and pay. SCF-funded | Live |
| [RouteDock](https://routedock.xyz/) | One `client.pay()` across x402, MPP charge and MPP session | Live |

Our seller gateway overlaps TollPay; our discovery router overlaps Rail402's MCP. Candidate differentiators, which the router has with tests and a live testnet run (checked only against the one-line Scout descriptions above, not their code, so verify before saying "only we"): a **persistent budget that survives restarts and concurrent calls**, **"unknown payment" held rather than released**, **idempotent invoke with a stored receipt**, **on-chain receipt verification**, and **one MCP across several catalogs** (our registry, Rail402 Bazaar, curated manifest). Lead with those, credit Rail402 as a catalog source, and don't claim demand from the gap (Scout's own caution).
