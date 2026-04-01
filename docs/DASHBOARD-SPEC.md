# AppBase Dashboard — Implementation Specification

> **Audience:** engineers implementing `apps/dashboard` and any supporting `apps/api` admin routes.  
> **Architecture decisions:** [ADR-006 — Dashboard Implementation](./adr/ADR-006-dashboard-implementation.md)  
> **Public BaaS contract (out of scope here):** [API-SPEC.md](./API-SPEC.md)

---

## 1. Purpose

The dashboard is the **operator console** for a **single** M1 BaaS instance (one SQLite DB, one storage root, one instance API key). It is intentionally similar in *spirit* to a Firebase project console: **settings**, **users**, **usage**, **audit**, not the end-user runtime API.

---

## 2. Non-goals (M1)

- Multi-tenant master UI (`apps/master` / M2+) — separate product.
- Defining or editing security “rules” for `/db/*` or `/storage/*` in a visual rules editor.
- Email/SMTP for self-service password reset.
- Embedding the instance `x-api-key` in `NEXT_PUBLIC_*` for production builds.

---

## 3. Personas

| Persona | Goal |
|---------|------|
| **Instance operator** | Copy or rotate API key, monitor users and usage, troubleshoot. |
| **Support / admin** | Reset end-user password (admin-mediated), review audit log. |

---

## 4. Information architecture (routes)

Suggested Next.js App Router structure:

| Path | Purpose |
|------|---------|
| `/login` | Operator sign-in (session cookie). |
| `/` | Overview: API base URL, health link, quick stats. |
| `/settings/api-key` | View / reveal / copy / **rotate** instance API key. |
| `/users` | List end-users; actions: view detail, **set password** (admin). |
| `/storage` | Storage usage summary (bytes, file count, optional by bucket). |
| `/audit` | Paginated audit log table with filters (action, date). |
| `/docs` | Redirect or open API Swagger (`GET /docs` on API) in new tab. |

**Navigation:** persistent sidebar or top nav with sections: Overview, API key, Users, Storage, Audit, Docs.

---

## 5. API integration

### 5.1 Transport

- **Base URL:** configurable server-side `API_BASE_URL` (e.g. `http://localhost:3000` in dev, `http://api:3000` in Docker compose internal network).
- **Pattern:** Next.js **Route Handlers** (`app/api/.../route.ts`) or **Server Actions** perform `fetch` to `apps/api` with headers:
  - `x-api-key: <server-only instance key>`
  - `Content-Type: application/json` where applicable
- **Operator session:** dashboard validates the logged-in operator **before** proxying admin calls (see §6).

### 5.2 Existing admin routes (ARCHITECTURE §5)

Implement dashboard pages against these once available in `apps/api`:

| Method | Path | Auth | Dashboard use |
|--------|------|------|----------------|
| GET | `/admin/users` | `x-api-key` | Users table |
| GET | `/admin/storage/usage` | `x-api-key` | Storage summary |
| GET | `/admin/audit-log` | `x-api-key` | Audit viewer (support `limit`, `offset`, optional filters if API adds them) |

**Response envelope:** match existing API convention `{ success, data }` / `{ success: false, error }` used elsewhere in the API.

### 5.3 API key management routes (to implement in `apps/api` if missing)

The ARCHITECTURE describes rotation UX; the API should expose explicit endpoints for the BFF:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/api-key` | `x-api-key` | Return metadata for display: at minimum `{ keyPrefix: "hs_live_", masked: "hs_live_••••abcd", lastRotatedAt?: ISO }`. **Optional:** full `key` for server-side proxy only (prefer returning full key only from `rotate` response to reduce leakage). |
| POST | `/admin/api-key/rotate` | `x-api-key` | Atomically revoke current key and create new one; return `{ key: "hs_live_..." }` in `data`; write `audit_log` action e.g. `api_key.rotate`. |

**Semantics:** align with **one active key** — rotation must not leave two valid keys.

**Security:** these routes are **not** for browser direct calls in production; only the dashboard **server** should call them with the configured key (until a stronger admin JWT exists).

### 5.4 Admin-mediated password reset

Per ADR-003, use better-auth **admin** capabilities (e.g. `setUserPassword`) behind a dashboard action:

- UI: Users → row action **Reset password** → modal with new password (or generate) → confirm.
- Implementation: Route Handler calls API endpoint that wraps `auth.api.setUserPassword` (or add `POST /admin/users/:id/password` in `apps/api` if not present), guarded by operator session + server `x-api-key`.

Document the chosen internal route in this file when implemented.

---

## 6. Operator authentication

### 6.1 Requirements

- Only **admin/operator** accounts can access dashboard routes.
- Use **httpOnly** session cookies where possible for the operator session.
- Session timeout and logout required.

### 6.2 Suggested approach

- **Option A (preferred):** First operator seeded via env (`DASHBOARD_BOOTSTRAP_EMAIL` / password) or one-time setup wizard that calls API to create admin user.
- **Option B:** Reuse `POST /auth/login` with a user that has **admin** role in better-auth, then dashboard BFF stores session (or forwards session cookie carefully — document same-site and CSRF).

Coordinate with `apps/api` auth plugin configuration from ADR-003.

---

## 7. Environment variables (`apps/dashboard`)

| Variable | Required | Description |
|----------|----------|-------------|
| `API_BASE_URL` | yes | Origin of `apps/api` for server-side fetches. |
| `DASHBOARD_API_KEY` | yes (prod BFF) | Current instance API key; **server-only**, never `NEXT_PUBLIC_`. |
| `AUTH_SECRET` / session secrets | as needed | NextAuth or custom session if used only in dashboard. |

**LAN demo mode (optional):** `NEXT_PUBLIC_ALLOW_CLIENT_API_KEY=true` — if set, allow client-held key with prominent warning (ADR-006); not for production.

---

## 8. UX requirements — API key page

- **Default state:** masked key, **Copy** copies full key only after reveal or via server action that returns one-time display (product choice).
- **Rotate:**
  - Step 1: explain impact (“all clients using the old key will fail until updated”).
  - Step 2: require confirmation (checkbox + button or type `ROTATE`).
  - Step 3: show **new key once** with Copy; suggest updating `.env` / deployment secrets.
- **Post-rotate:** update server config note — operator must set `DASHBOARD_API_KEY` to the new value for BFF (document in runbook / STORAGE-OPERATIONS style doc).

---

## 9. UX requirements — Users page

- Table: email, user id, created date, optional “banned” / status if exposed by API.
- Row actions: **Reset password** (admin), optional **Delete user** (only if API supports and product wants it).
- Empty state and loading skeletons.

---

## 10. UX requirements — Storage & Audit

- **Storage:** cards or table: total bytes, total files, optional breakdown by bucket if API returns it.
- **Audit:** paginated table; columns: time, action, userId, resource, resourceId; link to user where applicable.

---

## 11. Observability & health

- Overview calls `GET /health` (no API key) for green/red indicator.
- Display configured `API_BASE_URL` (read-only) for operator sanity checks.

---

## 12. Styling

- Use [APPBASE-VISUAL-SPEC.md](./design/APPBASE-VISUAL-SPEC.md) for typography, color, and component feel when matching the AppBase brand.

---

## 13. Testing

- **Unit:** formatters (mask key, dates), table helpers.
- **E2E (optional M1):** Playwright against docker-compose: login → reveal key → rotate → users list (seed data).
- **API contract:** integration tests live in `apps/api`; dashboard assumes stable admin JSON shapes — version admin responses carefully.

---

## 14. Delivery phases

| Phase | Deliverables |
|-------|----------------|
| **D1** | Login shell + BFF proxy pattern + Overview + health. |
| **D2** | API key page + `GET/POST /admin/api-key` in API. |
| **D3** | Users list + password reset action. |
| **D4** | Storage usage + audit log pages. |
| **D5** | Polish, a11y basics, empty states, error toasts. |

---

## 15. Acceptance criteria (M1 dashboard)

- [ ] Operator can sign in and sign out.
- [ ] API key can be viewed (masked/reveal), copied, and rotated with confirmation; rotation audited.
- [ ] Users list loads from `GET /admin/users`.
- [ ] Storage usage loads from `GET /admin/storage/usage`.
- [ ] Audit log loads from `GET /admin/audit-log` with pagination.
- [ ] Instance API key is **not** present in client bundle in production configuration (BFF-only).
- [ ] ADR-006 decisions reflected in code and env documentation.
