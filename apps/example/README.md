# Example app (`apps/example`)

Modern Next.js todo application using `@appbase/sdk` for auth and database access.

## Purpose

- Validate end-to-end auth + protected dashboard flow
- Demonstrate real todo CRUD via SDK database client
- Provide a clean reference structure for future frontend apps

## Setup

1. Make sure the **API is running** at `http://localhost:3000` (see `apps/api/`).
2. Create `apps/example/.env.local` from `.env.example`.
3. Put a valid instance API key in `NEXT_PUBLIC_APPBASE_API_KEY`.
4. Start this app (runs on port **3001** to avoid conflict with the API on 3000).

```bash
# Option A: Run both API and example together (from repo root)
pnpm dev

# Option B: Run only the example (API must already be running on 3000)
pnpm --filter example dev
```

The example uses port **3001**; the API uses **3000**. If the API is not running, you'll get `TypeError: Failed to fetch` on sign-in.

## Environment variables

- `NEXT_PUBLIC_APPBASE_ENDPOINT`
- `NEXT_PUBLIC_APPBASE_API_KEY`

Both are validated in `lib/env.ts`.

## Routes

- `/` Home (entry and navigation)
- `/sign-up` Account creation
- `/sign-in` Account login
- `/dashboard` Protected todo dashboard

## Features

- Sign up and sign in using `appBase.auth.*`
- Protected dashboard redirecting unauthenticated users to `/sign-in`
- Todo create/list/toggle/delete using typed `appBase.db.collection<T>("todos", TodoSchema)` with Zod schema
- List filtering: All / Open / Done (uses `list({ filter })` with equality on `done`)
- Sign out from dashboard

## SDK integration points

- App provider + hooks: `lib/appbase.tsx` (`useAuth`, `useRequireAuth`, `useAppBase`)
- Public env parsing: `lib/env.ts`
- Dashboard DB usage: `app/dashboard/page.tsx`
  - Typed collection: `appBase.db.collection<TodoData>("todos", TodoSchema)`
  - CRUD: `create`, `list`, `update`, `delete`
  - List options: `list({ filter: { done: false }, limit: 100 })`

## Notes

- **Access token** (+ user + expiry) is persisted in `localStorage` under `appbase_example_session`.
- **Session refresh** uses the HttpOnly **`appbase_session`** cookie. The SDK restores from `localStorage` and refreshes stale tokens automatically on startup.
- **Security:** access JWT in `localStorage` is a tradeoff; the session token stays in the HttpOnly cookie.
- If the SPA and API run on **different origins**, set **`CORS_ORIGINS`** on the API to your app origin.
- Make sure your API key can access auth and db endpoints.
