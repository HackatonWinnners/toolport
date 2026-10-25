# Deploying Toolport on Coolify

Toolport runs as three containers from one `Dockerfile` (targets `web`, `gateway`, `demo`), wired by
`docker-compose.yml`:

| Service | Target | Port | What it is |
|---|---|---|---|
| `web` | `web` | 3000 | Next.js standalone server (landing, playground, catalog, seller pages) |
| `gateway` | `gateway` | 4021 | Paid MCP gateway and API. SQLite on the `gateway-data` volume (`/data`) |
| `demo-server` | `demo` | 4022 | Stellar Oracle, a free upstream MCP server that the gateway prices |

The services only `expose` their ports. Coolify's proxy terminates TLS and routes each domain to its
container port.

## 1. Create the resource

1. In Coolify: **New resource**, pick the Git repository, then **Build pack: Docker Compose**.
2. **Base directory** `/`, **Docker Compose location** `docker-compose.yml`.
3. Do not add `docker-compose.local.yml`. It publishes ports and turns on private upstreams.

## 2. Domains

Set one domain per service, using Coolify's `https://host:port` syntax so the proxy targets the
container port:

| Service | Domain |
|---|---|
| `web` | `https://toolport.<domain>:3000` |
| `gateway` | `https://api.toolport.<domain>:4021` |
| `demo-server` | `https://oracle.toolport.<domain>:4022` |

Point the three DNS records at the Coolify host before deploying, so the certificates can be issued.

## 3. Environment

Coolify lists every `${VAR}` from the compose file. Set these and leave the rest at their defaults.

**Gateway**

| Variable | Value |
|---|---|
| `PUBLIC_URL` | `https://api.toolport.<domain>` |
| `WEB_ORIGIN` | `https://toolport.<domain>` (comma list if there are several web origins) |
| `DATABASE_URL` | `file:/data/toolport.db` (the default; the `gateway-data` volume keeps it) |
| `STELLAR_NETWORK` | `stellar:testnet` |
| `SESSION_SECRET` | secret, `openssl rand -hex 32`. Without it, sessions reset on every restart |
| `FACILITATOR_URL` | facilitator endpoint, for example `https://channels.openzeppelin.com/x402/testnet` |
| `FACILITATOR_API_KEY` | secret, if the facilitator needs one |
| `ALLOW_PRIVATE_UPSTREAMS` | `false` (see below) |
| `AUTH_DISABLED` | leave unset |

`FACILITATOR_SECRET_KEY` (an in-process facilitator) and `STELLAR_RPC_URL` are optional;
`STELLAR_RPC_URL` is required for `stellar:pubnet`. `DATABASE_AUTH_TOKEN` is only for a remote
libsql/Turso `DATABASE_URL`. The gateway creates its tables on first start, so there is no
migration step.

**Demo server**: `STELLAR_NETWORK=stellar:testnet`, `PAY_TO` unset (the gateway does the charging).
`PORT` is fixed to 4022 in the compose file.

**Web build variables.** These are inlined into the browser bundle when the image is built, so mark
them as **build variables** in Coolify and redeploy (rebuild) after changing them:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_GATEWAY_URL` | `https://api.toolport.<domain>` |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `stellar:testnet` |
| `NEXT_PUBLIC_DOCS_URL` | docs link shown in the UI (optional) |
| `NEXT_PUBLIC_REPO_URL` | repository link shown in the UI (optional) |

`NEXT_PUBLIC_STELLAR_RPC_URL`, `NEXT_PUBLIC_CLI_PATH` and `NEXT_PUBLIC_CLI_NPM` are optional.
**Never set `NEXT_PUBLIC_E2E_SIGNER`.** It is not a build argument of the image, and it must not
become one: it switches the web app to a test signer.

## 4. Deploy and check

Deploy, then wait for all three services to report healthy. The health checks are:

- web: `GET /` returns 200
- gateway: `GET /api/health` returns `"database": "ok"` (the endpoint is always HTTP 200; `facilitator`
  shows whether the facilitator answered)
- demo-server: `GET /` returns 200

```sh
curl -s https://api.toolport.<domain>/api/health
curl -s https://oracle.toolport.<domain>/
curl -sI https://toolport.<domain>/
```

## 5. Seed the gateway

Register the demo server and its prices once, from a laptop that has the provider wallet (the
gateway volume keeps it across deploys; the script is idempotent):

```sh
STELLARPAY_WALLET=.wallets/provider.json npx tsx scripts/seed-gateway.ts \
  https://api.toolport.<domain> https://oracle.toolport.<domain>/mcp
```

It prints the paid MCP URL. The playground should then list Stellar Oracle.

### Hairpin-NAT fallback

The gateway reaches the upstream through its public domain, which resolves to the Coolify host's
own public IP. Some hosts and routers do not route that back in (hairpin NAT), and registration
then fails with a connection error or timeout. In that case register the existing Vercel deployment
of the demo server as the upstream instead:

```sh
STELLARPAY_WALLET=.wallets/provider.json npx tsx scripts/seed-gateway.ts \
  https://api.toolport.<domain> https://stellarpay-demo.vercel.app/mcp
```

### Why `ALLOW_PRIVATE_UPSTREAMS` stays `false`

Registering `http://demo-server:4022/mcp` (the internal service name) would avoid the hairpin, but
that name resolves to a private address, which the gateway refuses unless
`ALLOW_PRIVATE_UPSTREAMS=true`. Do not turn it on. Seller registration is open to any wallet, so
with that setting anyone could register an "upstream" pointing at the Coolify host's internal
network (other containers, the Docker host, cloud metadata endpoints) and have the gateway call it
for them: a server-side request forgery. Use the public fallback above instead.

## Local run

The same images run locally with published ports:

```sh
cp .env.example .env   # fill in SESSION_SECRET and the facilitator settings
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

This serves web on `http://localhost:3000`, the gateway on `http://localhost:4021` and the demo
server on `http://localhost:4022`, bound to 127.0.0.1. Inside the gateway container `localhost` is
the gateway itself, so seed the demo server by its service name (the local file turns on private
upstreams for this, which is safe only on your own machine):

```sh
STELLARPAY_WALLET=.wallets/provider.json npx tsx scripts/seed-gateway.ts \
  http://localhost:4021 http://demo-server:4022/mcp
```

Building a single image without Compose:

```sh
docker build --target gateway -t toolport-gateway .
docker build --target web --build-arg NEXT_PUBLIC_GATEWAY_URL=http://localhost:4021 -t toolport-web .
```
