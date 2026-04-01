# Todo app (`apps/todo-app`)

Next.js todo demo that uses the workspace-linked **`@appbase-pfe/sdk`** (same code as published to npm, linked via `workspace:*`).

## Setup

1. Run the **API** (`pnpm --filter api dev`) and ensure you have a valid instance API key in `.env` / dev dashboard.
2. Copy env: `cp .env.example .env.local` and set `NEXT_PUBLIC_APPBASE_ENDPOINT` + `NEXT_PUBLIC_APPBASE_API_KEY`.

## Run

**From monorepo root (API + todo app):**

```bash
pnpm dev
```

(with a root `turbo dev` that includes this app, or run filters side by side)

**Todo app only** (API must already be running on port **3000**):

```bash
pnpm --filter todo-app dev
```

The app listens on **3001**; the API uses **3000** by default.

## Session storage

Access token and session metadata use `localStorage` under **`appbase_todo_app_session`** (see `lib/appbase.tsx`).
