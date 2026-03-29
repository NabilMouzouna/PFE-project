# Changelog

## 0.1.0 — 2026-03-29

- Initial public publish preparation: compiled `dist/` ESM entries (`"."`, `"./react"`), workspace protocol on `@appbase/types` for monorepo dev (rewritten to `^0.1.0` in the published tarball), optional `react` peer for `@appbase/sdk/react`, MIT license, repository metadata (see [TICKET-012](../../tasks/TICKET-012-sdk-npm-publish-readiness.md)).
- Emit uses **Node16/NodeNext** resolution: relative imports in `dist/` use **`.js` extensions** so Node’s native ESM loader can resolve the package without a bundler.
