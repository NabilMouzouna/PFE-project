# `todo-vanilla-npm` — Vite + TypeScript + **npm** `@appbase-pfe/sdk`

Minimal browser app that **depends on `@appbase-pfe/sdk` with a semver range** (`^0.1.0`), like an external consumer.

### Monorepo dev (default)

With **no** extra `.npmrc`, `pnpm` **links** `packages/sdk` when the version matches — you can develop before anything is published.

### Force “real npm” resolution (after publish)

When the packages are on npm and you want this app to download them like a customer would:

```bash
cp .npmrc.force-registry .npmrc
pnpm install
```

Until **`@appbase-pfe/sdk`** is published, that mode fails with `404` from the registry (expected).

### External smoke test (always “real npm”)

```bash
mkdir /tmp/ab-client && cd /tmp/ab-client && npm init -y
npm install @appbase-pfe/sdk@^0.1.0 zod
```

## Configure

```bash
cp .env.example .env
```

Set `VITE_APPBASE_ENDPOINT` and `VITE_APPBASE_API_KEY` (instance key from your API / dashboard).

## Run

API on **:3000**, then:

```bash
pnpm --filter todo-vanilla-npm dev
```

Opens **http://localhost:5180** (Vite). The API allows this origin in default dev CORS (see `apps/api` `buildCorsAllowedOrigins`).

## Contrast

| App | SDK dependency |
|-----|----------------|
| `apps/todo-app` | `workspace:*` (always linked) |
| `apps/todo-vanilla-npm` | `^0.1.0` semver — linked in repo by default; use `.npmrc.force-registry` or an external folder to consume **from npm** |
