# AppBase API — M1 MVP
# Single Fastify process on port 3000 (ARCHITECTURE §6).
# Data: data/appbase.sqlite + data/storage/ (ARCHITECTURE §7).

# === Builder — install deps + native module compilation ===
FROM node:22-bookworm-slim AS builder

RUN apt-get update -y && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json packages/db/tsconfig.json packages/db/drizzle.config.ts ./packages/db/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/db/src ./packages/db/src
COPY packages/types/src ./packages/types/src
COPY packages/config ./packages/config
COPY apps/api/src ./apps/api/src

# === Runner — minimal runtime image ===
FROM node:22-bookworm-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV="production"

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

RUN mkdir -p /app/data/storage

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/appbase.sqlite

VOLUME ["/app/data"]

CMD ["pnpm", "exec", "tsx", "apps/api/src/index.ts"]
