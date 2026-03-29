# ADR-006 — App-Specific Dashboard (`apps/dashboard`)

**Status:** Accepted  
**Date:** 2026-03-29  
**Deciders:** AppBase core team  
**Tags:** `frontend`, `dashboard`, `security`, `nextjs`, `architecture`

---

## Context

Each M1 **BaaS unit** ships with `apps/dashboard` (Next.js, typically `localhost:3001`). The dashboard is the **operator-facing** UI for that single app instance: manage the **instance API key**, inspect **end-users**, view **storage usage** and **audit log**, and perform **admin-mediated** tasks (e.g. password reset) described in [ADR-003](./ADR-003-auth-implementation.md).

**Product reference:** Firebase-style “project console” — not the public SDK contract. End-user apps use `@appbase/sdk` and `/auth/*`, `/db/*`, `/storage/*`; the dashboard uses **internal** auth and **admin** API surfaces.

**Constraints**

- [ARCHITECTURE.md](../ARCHITECTURE.md) §5 lists admin routes (`/admin/users`, `/admin/storage/usage`, `/admin/audit-log`) authenticated with **`x-api-key` only** (no end-user JWT on those paths).
- **One active API key per instance**; rotation revokes the previous key atomically (ARCHITECTURE §2.3).
- The instance API key is **not a browser secret** if embedded in client bundles; operators using Burp or DevTools can copy it. The dashboard design must **not** make the situation worse than necessary (prefer server-side key handling).

---

## Decision

### 1. Contract boundary

- The dashboard is **out of scope** for [API-SPEC.md](../API-SPEC.md) (public BaaS contract). Dashboard-specific request/response shapes may be documented in [DASHBOARD-SPEC.md](../DASHBOARD-SPEC.md) and OpenAPI under a dedicated tag if desired.
- Implementation lives in **`apps/dashboard`**; server-side proxies (Route Handlers / Server Actions) are encouraged so **`x-api-key` is not compiled into client JavaScript**.

### 2. Recommended integration pattern (production-minded)

**Backend-for-frontend (BFF) within Next.js**

- Browser session = **operator** authenticated via dashboard login (cookie session).
- Server components / Route Handlers call `apps/api` with:
  - `x-api-key` read from **server-only** config: e.g. `DASHBOARD_API_KEY` or `INTERNAL_API_KEY` (injected at deploy time, same value as the instance key the operator manages — or a dedicated bootstrap secret; see §2.3).
- Client components never receive the raw API key except in **explicit copy-to-clipboard** flows that are fed from **server responses** after operator re-auth for sensitive actions (optional hardening), not from `NEXT_PUBLIC_*`.

**M1 LAN / demo shortcut (documented, lower assurance)**

- Operator pastes the API key once into dashboard settings; stored in **sessionStorage** or secure cookie managed by the dashboard only for LAN demos. Must be labeled **insecure for production** in docs.

### 3. Operator authentication

- Operators are **distinct** from arbitrary end-users: use **better-auth `admin` role** (per ADR-003) or a dedicated operator account seeded at first boot.
- Dashboard login uses **cookie-based session** to the API (or to dashboard-only auth that proxies admin calls). Align with existing auth stack; avoid inventing a second password store.
- All destructive actions (rotate API key, set user password) require **confirmed intent** (modal + typed confirm or re-enter password).

### 4. API key management

- **Display:** show key with **mask by default** (`hs_live_••••abcd`), **Reveal** toggles full string, **Copy** uses clipboard API.
- **Rotate:** single action **Regenerate key** → call **`POST /admin/api-key/rotate`** (see DASHBOARD-SPEC; implement in `apps/api` if not present). Response returns **new key once**; warn that all clients must update env. Old key invalid immediately (atomic with DB).
- **Audit:** every rotation (and initial creation) writes **`audit_log`** (action names stable; see DASHBOARD-SPEC).

### 5. Pages (M1 scope)

Minimum IA: **Overview**, **API key**, **Users**, **Storage usage**, **Audit log**, link to **`/docs`** on API. Optional later: read-only DB explorer, settings for CORS/MIME (read-only display first).

### 6. Visual consistency

- Follow [APPBASE-VISUAL-SPEC.md](../design/APPBASE-VISUAL-SPEC.md) §8.2 for dashboard surfaces when branding should match marketing/example apps.

---

## Options Considered

### A — Dashboard calls API from browser with `x-api-key` in frontend env

**Pros:** simplest build.  
**Cons:** key in bundle or env exposed to client; trivially stealable.  
**Assessment:** rejected for **production**; acceptable only for documented LAN demo mode.

### B — Next.js BFF + server-only API key

**Pros:** key stays on server; matches Firebase-console security expectations.  
**Cons:** requires deploy env wiring (`DASHBOARD_API_KEY` = current instance key).  
**Assessment:** **accepted** as default recommendation.

### C — Separate “dashboard service account” JWT instead of API key for admin routes

**Pros:** no long-lived key in dashboard server config.  
**Cons:** new token type, middleware changes, more moving parts for M1.  
**Assessment:** defer to M2+ unless security review demands it.

---

## Consequences

**Positive**

- Clear split: public SDK contract vs operator console.
- API key rotation story matches ARCHITECTURE (single key, audit).

**Negative / follow-up**

- Engineers must implement **`/admin/api-key` read + rotate`** in `apps/api` if not already present, plus ensure `apiKeyMiddleware` allows `/admin/*` with valid key.
- Operators must configure **`DASHBOARD_API_KEY`** (or equivalent) in container/env for BFF pattern.

---

## References

- [ARCHITECTURE.md](../ARCHITECTURE.md) — §2.3 API key lifecycle, §5 admin routes  
- [ADR-003](./ADR-003-auth-implementation.md) — admin plugin, password reset  
- [DASHBOARD-SPEC.md](../DASHBOARD-SPEC.md) — normative UI and API details for implementers  
- [APPBASE-VISUAL-SPEC.md](../design/APPBASE-VISUAL-SPEC.md)
