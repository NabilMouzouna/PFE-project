# AppBase M1 — API (Fastify) + dashboard (Next.js standalone).
#
# Image size: runner does not ship the full monorepo, pnpm, or devDependencies.
# - API: `pnpm deploy --prod` → /app/api-bundle (tsx + prod node_modules + workspace packages).
# - Dashboard: Next standalone + static assets only.
#
# Ports: API 8000, dashboard 3001 (override with API_PORT / DASHBOARD_PORT).

# === Builder — minimal COPY + install + build + API deploy bundle ===
FROM node:22-bookworm-slim AS builder

RUN apt-get update -y && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Only workspace paths required for dashboard + api builds (not the whole repo tree).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY packages/db ./packages/db
COPY packages/storage ./packages/storage
COPY packages/sdk ./packages/sdk
COPY apps/api ./apps/api
COPY apps/dashboard ./apps/dashboard

RUN pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec turbo run build --filter=dashboard --filter=api

# Prod-only portable tree for the API (no pnpm needed at runtime).
RUN pnpm --filter api deploy --prod /app/api-bundle \
  && rm -rf /app/api-bundle/dist \
            /app/api-bundle/scripts \
            /app/api-bundle/.turbo \
            /app/api-bundle/data \
  && rm -f /app/api-bundle/README.md \
           /app/api-bundle/TESTING.md \
           /app/api-bundle/eslint.config.js \
           /app/api-bundle/auth.http \
           /app/api-bundle/database.http

# === Runner — Node only: api-bundle + Next standalone ===
FROM node:22-bookworm-slim AS runner

ENV NODE_ENV="production"
WORKDIR /app

COPY --from=builder /app/api-bundle ./api-bundle
COPY --from=builder /app/apps/dashboard/.next/standalone ./dashboard-standalone
COPY --from=builder /app/apps/dashboard/.next/static ./dashboard-standalone/apps/dashboard/.next/static

COPY docker/entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

RUN mkdir -p /app/data/storage

EXPOSE 8000 3001

ENV API_PORT=8000
ENV DASHBOARD_PORT=3001
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/appbase.sqlite
ENV API_BASE_URL=http://127.0.0.1:8000

VOLUME ["/app/data"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
