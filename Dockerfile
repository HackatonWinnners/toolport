# syntax=docker/dockerfile:1
# One image definition for the three Toolport services. Pick a service with --target:
#   docker build --target gateway -t toolport-gateway .
#   docker build --target demo    -t toolport-demo .
#   docker build --target web     -t toolport-web --build-arg NEXT_PUBLIC_GATEWAY_URL=https://api.example.com .
# The workspace is TypeScript run through tsx (no build step), except the Next.js web app.

FROM node:22-bookworm-slim AS base
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false
WORKDIR /app
RUN chown node:node /app
USER node

# ---- deps: manifests and lockfile only, so source edits keep this layer cached ----
FROM base AS deps
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/demo-server/package.json apps/demo-server/
COPY --chown=node:node apps/gateway/package.json apps/gateway/
COPY --chown=node:node apps/web/package.json apps/web/
COPY --chown=node:node packages/cli/package.json packages/cli/
COPY --chown=node:node packages/core/package.json packages/core/
COPY --chown=node:node packages/mcp/package.json packages/mcp/
COPY --chown=node:node packages/router/package.json packages/router/
# The CLI's bin target, so npm can link (and chmod) it during install.
COPY --chown=node:node packages/cli/bin packages/cli/bin
# Dev dependencies are needed too: tsx runs the services and next/tailwind build the web app.
RUN npm ci --include=dev

# ---- source: the whole tree on top of the installed node_modules ----
FROM deps AS source
COPY --chown=node:node . .

# ---- gateway ----
FROM source AS gateway
USER root
RUN mkdir -p /data && chown node:node /data
USER node
ENV PORT=4021 \
    DATABASE_URL=file:/data/toolport.db
VOLUME ["/data"]
EXPOSE 4021
# /api/health is always HTTP 200; healthy means the database answered.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4021)+'/api/health').then(r=>r.json()).then(j=>process.exit(j.database==='ok'?0:1),()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "apps/gateway/src/index.ts"]

# ---- demo (Stellar Oracle MCP server) ----
FROM source AS demo
ENV PORT=4022
EXPOSE 4022
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4022)+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "apps/demo-server/src/index.ts"]

# ---- web build: NEXT_PUBLIC_* values are inlined into the bundle here ----
FROM source AS web-build
# NEXT_PUBLIC_E2E_SIGNER is deliberately not declared: the e2e signer must never ship in an image.
ARG NEXT_PUBLIC_GATEWAY_URL
ARG NEXT_PUBLIC_STELLAR_NETWORK
ARG NEXT_PUBLIC_STELLAR_RPC_URL
ARG NEXT_PUBLIC_DOCS_URL
ARG NEXT_PUBLIC_REPO_URL
ARG NEXT_PUBLIC_CLI_PATH
ARG NEXT_PUBLIC_CLI_NPM
ENV NEXT_PUBLIC_GATEWAY_URL=${NEXT_PUBLIC_GATEWAY_URL} \
    NEXT_PUBLIC_STELLAR_NETWORK=${NEXT_PUBLIC_STELLAR_NETWORK} \
    NEXT_PUBLIC_STELLAR_RPC_URL=${NEXT_PUBLIC_STELLAR_RPC_URL} \
    NEXT_PUBLIC_DOCS_URL=${NEXT_PUBLIC_DOCS_URL} \
    NEXT_PUBLIC_REPO_URL=${NEXT_PUBLIC_REPO_URL} \
    NEXT_PUBLIC_CLI_PATH=${NEXT_PUBLIC_CLI_PATH} \
    NEXT_PUBLIC_CLI_NPM=${NEXT_PUBLIC_CLI_NPM}
# Compose passes unset build args as empty strings, and the app reads several of these with `??`,
# so drop the empty ones and let the app's defaults apply. public/ is created so the runtime COPY
# below works whether or not the app has static files there.
RUN for v in NEXT_PUBLIC_GATEWAY_URL NEXT_PUBLIC_STELLAR_NETWORK NEXT_PUBLIC_STELLAR_RPC_URL \
      NEXT_PUBLIC_DOCS_URL NEXT_PUBLIC_REPO_URL NEXT_PUBLIC_CLI_PATH NEXT_PUBLIC_CLI_NPM; do \
      eval "[ -n \"\${$v}\" ] || unset $v"; \
    done; \
    unset NEXT_PUBLIC_E2E_SIGNER; \
    mkdir -p apps/web/public && npm run build -w @stellarpay/web

# ---- web runtime: only the standalone server, its traced node_modules and the static assets ----
FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
