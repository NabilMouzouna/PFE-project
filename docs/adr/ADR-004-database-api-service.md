# ADR-004 — Database API Service (`/db/*`)

**Status:** Accepted  
**Date:** 2026-03-19  
**Deciders:** AppBase core team  
**Tags:** `backend`, `api`, `database`, `sqlite`, `sse`, `architecture`

---

## Context

AppBase exposes a **document-style database API** under `/db/*` for app developers using `@appbase-pfe/sdk`. The public contract is defined in `[API-SPEC.md](../API-SPEC.md)` §7; the physical model and flow are described in `[ARCHITECTURE.md](../ARCHITECTURE.md)` §3.4, §4 (`records` table), and §5 (route table).

**Product goals**

- **Per-user isolation:** Every record is owned by the authenticated user (`owner_id` = JWT `sub`). No cross-tenant or cross-user reads/writes through this API.
- **Developer-defined collections:** The `:collection` path segment groups records logically (e.g. `passwords`, `notes`). The server does not validate JSON shape inside `data` beyond being a JSON object (M1); schema evolution is the app’s responsibility.
- **CRUD + real-time:** REST for create/list/get/update/delete plus **Server-Sent Events** on `GET /db/collections/:collection/subscribe` so clients can stay in sync without polling.

**Technical constraints (M1)**

- Single Node process, **Fastify** ([ADR-001](./ADR-001-api-framework-selection.md)), **SQLite** via **Drizzle + `better-sqlite3`** ([ADR-002](./ADR-002-orm-and-migration-strategy.md)).
- Protected routes require `**x-api-key**` + `**Authorization: Bearer <access-token>**` ([ADR-003](./ADR-003-auth-implementation.md)); the DB plugin runs **after** global auth middleware decorates `request` with the verified user identity.
- No Redis or second service in M1 — real-time delivery must work **in-process**.

**Open clarification from API-SPEC**

- The SSE example in API-SPEC §7.8 shows a flattened `record` in `data` while the **Shared Record Object** elsewhere includes `id`, `collection`, `ownerId`, timestamps. The implementation **should** emit payloads consistent with the **Shared Record Object** (or a documented subset) so the SDK has one mental model; any spec tweak is a follow-up doc PR.

---

## Decision

### 1. Service shape

Implement the Database API as a **Fastify plugin** registered in `apps/api` (e.g. `dbPlugin`), prefix `/db`, mirroring the **Storage** plugin pattern. All `/db/*` routes (except if we ever add a public health under `/db` — we do not) require the same **API key + JWT** preconditions as `/storage/*`.

### 2. Persistence

- Use the existing `**records`** table (see ARCHITECTURE §4): `id`, `collection`, `owner_id`, `data` (JSON text), `created_at`, `updated_at`.
- **Record IDs:** Generate opaque string IDs (e.g. **nanoid**), stable and URL-safe, consistent with other AppBase resources.
- **Timestamps:** Store as integers (Unix ms or s — **match existing `packages/db` conventions**); serialize to ISO 8601 strings in JSON responses per API-SPEC.

### 3. Authorization and scoping

- **Create:** Set `owner_id` from JWT `sub` only — ignore any `ownerId` sent in the body.
- **Read / list / update / delete:** Always constrain queries with `owner_id = sub` **and** `collection = :collection` from the path. Wrong owner or missing row → `**NOT_FOUND`** (avoid leaking existence across users) unless the team standardizes on `FORBIDDEN` for wrong-owner — **prefer `NOT_FOUND`** for list/get/update/delete by id.

### 4. Request validation

- **Collection** path segment: restrict to a safe charset (e.g. alphanumeric + hyphen/underscore), max length (e.g. 64). Reject invalid names with `**VALIDATION_ERROR`**.
- **Body:** `POST` / `PUT` require `{ "data": { ... } }` where `data` is a **JSON object** (not array/primitive at top level). Max payload size aligned with Fastify/global body limits.
- **List:** Support `limit`, `offset`, and optional `filter` as in API-SPEC. **M1 filter semantics (minimal):** interpret `filter` as **URL-encoded JSON object** expressing **AND equality** on **top-level keys** of the stored `data` JSON (implemented with SQLite `json_extract` / Drizzle raw fragment). Unsupported operators → `**VALIDATION_ERROR`** with a clear message. Document exact supported grammar in route schema description or API-SPEC appendix when implemented.

### 5. Responses

- Wrap successes in `{ "success": true, "data": ... }` and errors in the standard error envelope (API-SPEC §4). Use codes `**VALIDATION_ERROR**`, `**NOT_FOUND**`, `**INVALID_TOKEN**`, `**INVALID_API_KEY**`, `**INTERNAL_ERROR**` as appropriate.

### 6. Real-time (SSE)

- **Mechanism:** **In-process publish/subscribe** keyed by `(collection, ownerId)`. After a successful **commit** of INSERT/UPDATE/DELETE on `records`, publish an event to subscribers for that collection and owner.
- **Transport:** `GET /db/collections/:collection/subscribe` with `Accept: text/event-stream`, same auth headers as other `/db` routes. Use Fastify’s reply streaming / SSE helpers; set headers for no cache, keep-alive as appropriate.
- **Events:** Align names with API-SPEC (`**created`**, `**updated**`, `**deleted**`). Payload must include enough for clients to reconcile local state (at minimum `type`, `collection`, and record id; **prefer full record** for create/update).
- **Lifecycle:** On client disconnect, remove listeners to avoid leaks. **Backpressure:** if a client is slow, apply a bounded buffer or drop policy documented in implementation notes (M1 may choose “best effort” with small buffer).

### 7. Audit log (optional but recommended)

Write `**audit_log`** rows for `record.create`, `record.update`, `record.delete` with `resource: 'records'`, `resource_id`, and `user_id` = `sub`, to match dashboard/admin expectations in ARCHITECTURE.

### 8. SDK alignment (out of scope for this ADR but contract-bound)

The `@appbase-pfe/sdk` should gain typed helpers for collections mirroring API-SPEC; implementation is tracked in the companion ticket, not here.

---

## Options Considered

### A — Separate microservice for `/db`

**Rejected for M1:** Extra deployment, latency, and auth propagation for no benefit at current scale. Revisit only if the BaaS unit splits for resource isolation.

### B — GraphQL or OData instead of REST + SSE

**Rejected:** Public contract is REST + SSE in API-SPEC; changing surface would break SDK and docs.

### C — External message broker (Redis, NATS) for SSE fan-out

**Rejected for M1:** Operational burden. In-process pub/sub is sufficient for single-instance LAN deployments. M2+ multi-node would need a broker or sticky sessions — document as future ADR if needed.

---

## Consequences

**Positive**

- Clear alignment between **ARCHITECTURE**, **API-SPEC**, and **Drizzle schema**.
- User isolation is enforceable entirely in SQL predicates.
- SSE works without new infrastructure.

**Negative / risks**

- **SQLite write serialization:** Heavy write + many SSE clients on one instance can contend; acceptable for M1 target workloads.
- **Filter language** will grow; starting minimal avoids over-promising in API-SPEC — document supported filter syntax when shipping.
- **Horizontal scaling** (multiple API replicas) invalidates in-process SSE unless sticky sessions or external bus — out of M1 scope.

---

## References

- `[ARCHITECTURE.md](../ARCHITECTURE.md)` — §3.4 flow, §4 `records`, §5 route table  
- `[API-SPEC.md](../API-SPEC.md)` — §7 Database Endpoints  
- [ADR-001](./ADR-001-api-framework-selection.md), [ADR-002](./ADR-002-orm-and-migration-strategy.md), [ADR-003](./ADR-003-auth-implementation.md)

