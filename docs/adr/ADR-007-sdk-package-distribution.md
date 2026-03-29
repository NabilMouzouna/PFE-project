# ADR-007 — SDK Package Distribution (npm vs GitHub Packages)

**Status:** Accepted  
**Date:** 2026-03-29  
**Deciders:** AppBase core team  
**Tags:** `sdk`, `npm`, `distribution`, `platform`

---

## Context

AppBase targets **external developers** who deploy their own BaaS instance and build applications **outside** this monorepo. The public HTTP contract is [`API-SPEC.md`](../API-SPEC.md); [`@appbase/sdk`](../ARCHITECTURE.md) is the supported client for JS/TS.

We need a **default distribution channel** that is:

- **Free** for open-source / public packages
- **Low friction** for consumers (`npm install`, CI, bundlers)
- **Operable** by a small team without paid registry lock-in

Candidates:

1. **npm public registry** (scoped package, e.g. `@<scope>/sdk`)
2. **GitHub Packages** (npm-compatible registry hosted by GitHub)

---

## Decision

**Publish the SDK (and its type dependency) to the public npm registry.**

- Primary packages: **`@appbase/types`** and **`@appbase/sdk`** (exact scope subject to npm availability — see §Naming).
- **GitHub Packages** is **not** the default distribution path for M1. It may be revisited for **private** beta or org-internal mirrors later.

---

## Rationale

| Criterion | npm public | GitHub Packages |
|-----------|------------|-----------------|
| Consumer install | `npm install @scope/sdk` — works everywhere | Often requires `.npmrc` + `registry` mapping per scope; more docs/support burden |
| Tooling / docs | Universal in JS ecosystem | Fine, but extra setup for every new project |
| Cost (public OSS) | Free | Free tier exists; still more moving parts |
| Discoverability | npmjs.com search, Dependabot, etc. | Less visible to generic JS devs |

For a **platform** where developers copy one line from docs, **npm public** is the **easiest** default.

---

## Naming (`@appbase` scope)

The scope **`@appbase`** on npm may require an **npm organization** or may be unavailable. Before first publish:

1. Confirm **`@appbase`** is creatable/owned by the project, **or**
2. Choose an owned scope (e.g. `@appbasehq/sdk`, `@your-org/appbase-sdk`) and use it consistently in docs and `package.json`.

The ADR is agnostic to the final string; the **registry choice** is npm public.

---

## Consequences

**Positive**

- External apps use the same workflow as every other npm library.
- No consumer `.npmrc` for public installs.

**Negative / follow-up**

- Publishing requires npm accounts, 2FA, and CI secrets (`NPM_TOKEN`).
- **`@appbase/types`** must be published (or types inlined) because **`@appbase/sdk`** depends on it — two packages to version (keep semver aligned or use exact ranges initially).
- Package must ship **compiled `dist/`** and stable **`exports`** — not raw `workspace:*` or `src/*.ts` entrypoints.

**Implementation** is tracked in [TICKET-012](../../tasks/TICKET-012-sdk-npm-publish-readiness.md). Maintainer commands and CI tags are documented in [`PUBLISHING-SDK.md`](../PUBLISHING-SDK.md).

---

## References

- [`ARCHITECTURE.md`](../ARCHITECTURE.md) §1 — SDK used by external applications  
- [`packages/sdk/README.md`](../../packages/sdk/README.md)
