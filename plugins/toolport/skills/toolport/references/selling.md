# Selling an MCP server through the Toolport gateway

The gateway (`https://api.toolport.042067.xyz`) sits in front of an existing MCP server, charges per call in USDC and pays the owner. Failed tool calls are never settled.

## Before registering

- **Provider wallet**: a Stellar account with a USDC trustline. It is the owner and, unless `payTo` is set, the `payTo` that receives payments. Use a different wallet from the one that buys tools.
- **Upstream**: a public `https://` MCP endpoint. The gateway refuses private and loopback addresses. Keep the upstream URL secret: callers who reach it directly skip payment.

## Sign in (SEP-53)

1. `POST /api/auth/challenge` with `{ "address": "G..." }` → `{ "message" }`.
2. Sign `sha256("Stellar Signed Message:\n" + message)` with the provider key.
3. `POST /api/auth/verify` with `{ address, message, signature }` (base64) → `{ "token" }`; send it as `Authorization: Bearer <token>`.

The web dashboard `https://toolport.042067.xyz/dashboard` does this with Freighter. For code, model it on `scripts/seed-gateway.ts` in the toolport repo; that script hardcodes the Stellar Oracle name and prices, so adapt those before running it.

## Register and price

| Request | Body |
| --- | --- |
| `POST /api/servers` | `{ upstreamUrl, name, description, prices: { "<tool>": "$0.02" }, payTo?, listed? }` |
| `PATCH /api/servers/:id/tools/:name` | `{ price: "$0.02", enabled: true }` |
| `POST /api/servers/:id/refresh` | none; re-reads the upstream tool list |
| `GET /api/servers?mine=true` | lists your servers |

The response carries `mcpUrl` (`https://api.toolport.042067.xyz/v1/mcp/<serverId>`), the paid endpoint buyers use. Tools the upstream adds after registration start closed: refresh, then price and enable each one.

## Alternative: charge in your own server

`createPaidMcpHandler(setup, { payTo, facilitator })` from `@stellarpay/mcp/server` builds a Streamable-HTTP MCP handler; inside `setup`, `server.paidTool(name, description, price, inputShape, handler)` registers a tool that settles via x402 only on success.
