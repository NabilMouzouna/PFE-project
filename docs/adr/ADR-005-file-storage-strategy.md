# ADR-005 — File Storage Strategy

**Status:** Accepted  
**Date:** 2026-03-19  
**Deciders:** AppBase core team  
**Tags:** `backend`, `storage`, `filesystem`, `docker`, `architecture`

---

## Context

AppBase exposes file APIs under `/storage/*` and persists file metadata in the `files` table (`id`, `bucket`, `filename`, `mime_type`, `size`, `storage_path`, `owner_id`, `created_at`). The current architecture explicitly models file bytes on disk (`data/storage/...`) and metadata in SQLite (`appbase.sqlite`) for M1, then per-app isolation in M2+ (`data/{appId}/app.sqlite` + `data/{appId}/storage/`).

Deployment model is also explicit: **one app = one container** for M1 BaaS units. Therefore, file persistence cannot rely on the ephemeral container writable layer; it must use mounted host volumes.

We need a storage strategy that is:

- Production-reasonable for LAN/offline/self-hosted VPS usage
- Simple to run with minimal dependencies in M1
- Extensible to S3-compatible object stores later without rewriting `/storage/*` business logic
- Compatible with future versioning and retention policies

Options considered in this ADR:

1. Local filesystem with structured paths
2. Object storage abstraction (S3-compatible readiness)
3. SQLite BLOB storage

We also need a versioning decision:

- Filename suffix versioning (`report_v2.pdf`)
- Metadata-based version tracking (version history in DB)

---

## Decision

### 1. Storage backend

Adopt a **storage driver abstraction** and ship **local filesystem** as the default/first implementation.

- M1 runtime uses local FS for file bytes.
- File metadata remains in SQLite (`files` table and future version metadata tables if needed).
- `/storage/*` routes and service logic depend on an internal interface (e.g. `StorageDriver`) rather than directly on `fs`.

### 2. Container persistence contract

In containerized deployment, both database and file bytes must live on mounted volumes:

- SQLite: `/app/data/appbase.sqlite` (M1 single app)
- File bytes: `/app/data/storage/...`

For M2+ per-app isolation:

- SQLite: `/app/data/{appId}/app.sqlite`
- File bytes: `/app/data/{appId}/storage/...`

Using the container writable layer for durable data is prohibited for production.

### 3. Object-store readiness

The abstraction must support adding an S3-compatible adapter later (MinIO/AWS S3/R2 style APIs) without changing route contracts.

- M1 ships FS adapter only (unless explicitly enabled by later ticket)
- Future object-store adapter is additive and selected by config (`STORAGE_DRIVER=fs|s3`)

### 4. SQLite BLOB stance

Reject SQLite BLOB as the primary file storage backend.

Reasons:

- Poor operational profile for medium/large files (DB growth, backup/restore weight, vacuum pressure)
- Blurs transactional metadata concerns with large binary I/O
- Harder to evolve toward external object storage later

### 5. Versioning strategy

Use **metadata tracking** as the source of truth, not filename suffix parsing.

- Object keys/physical paths should be opaque and immutable (ID-based)
- Version semantics live in metadata (version number, logical file ID, created timestamp, pointer to storage object, etc.)
- Human filename suffixes may exist as display conventions only, never as canonical version logic

---

## Option Evaluation

### Option A — Local filesystem only (no abstraction)

**Pros**
- Simplest implementation now
- Fast and predictable on single-node LAN/VPS

**Cons**
- Couples business logic tightly to local FS
- Makes S3/MinIO migration more expensive later

**Assessment:** Partially accepted; use FS now, but behind an abstraction.

### Option B — Object storage abstraction with FS-first adapter

**Pros**
- Best balance: simple M1 runtime + future-proof design
- Enables S3-compatible support later without API break
- Keeps storage concerns isolated behind one interface

**Cons**
- Slightly more upfront design work

**Assessment:** Accepted.

### Option C — SQLite BLOB storage

**Pros**
- Single persistence primitive
- Very small prototype simplicity

**Cons**
- Degrades operationally as file sizes/count grow
- Slower and heavier backups
- Unnecessary coupling to DB internals

**Assessment:** Rejected.

---

## Consequences

**Positive**

- Aligns with current architecture and API-SPEC storage shape
- Works well for offline/LAN/personal-server use cases
- Clear migration path to S3-compatible backends
- Cleaner backup strategy (volume + DB metadata)

**Negative / risks**

- Requires robust filesystem hygiene (path validation, safe writes, cleanup)
- Need consistency jobs/guards for orphan files or stale metadata
- S3 adapter remains future work and must be validated separately

---

## Operational Guardrails (normative for implementation tickets)

- Validate and normalize bucket/file path components to prevent traversal.
- Write uploads atomically (temp file + rename).
- Store checksum/hash in metadata where feasible.
- Enforce max upload size and content-type allowlist policy.
- Ensure delete path removes file bytes and metadata coherently.
- Add periodic reconciliation tooling (detect metadata without object and object without metadata).

---

## References

- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — §3.3 storage flow, §4 `files` schema, §7 data layout  
- [`API-SPEC.md`](../API-SPEC.md) — §6 Storage Endpoints  
- [ADR-001](./ADR-001-api-framework-selection.md), [ADR-002](./ADR-002-orm-and-migration-strategy.md), [ADR-003](./ADR-003-auth-implementation.md)
