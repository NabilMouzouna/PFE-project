# @appbase/sdk

JavaScript/TypeScript SDK for [AppBase](https://github.com/NabilMouzouna/NubleCloud-PFE).

## Install (npm)

Use the public npm registry. The scope **`@appbase`** must exist on npm for your organization (see [ADR-007](../../docs/adr/ADR-007-sdk-package-distribution.md)); if you publish under a different scope, replace it in install commands and imports.

```bash
npm install @appbase/sdk
```

`@appbase/sdk` depends on **`@appbase/types`** at a compatible semver range; npm installs both.

**HTTP contract:** [`docs/API-SPEC.md`](../../docs/API-SPEC.md).

## Quick start

```ts
import { AppBase } from "@appbase/sdk";

const appbase = AppBase.init({
  endpoint: "http://localhost:3000",
  apiKey: "hs_live_your_key",
  sessionStorageKey: "my_app_session",
});

const { signIn, signOut, signUp, getAuthState } = appbase.auth;
const { authenticated, user } = getAuthState();

const todos = appbase.db.collection("todos");
const { items } = await todos.list();
```

## React (optional)

`react` is an **optional** peer dependency. Use the subpath when you need hooks / provider:

```tsx
import { AppBaseProvider, useAppBase, useAuth } from "@appbase/sdk/react";
```

Install `react` in your app (`>=18`).

## Services

| Service | Status |
|---------|--------|
| **`appbase.auth`** | [Auth docs](./docs/auth-service.md) |
| **`appbase.db`** | [Database docs](./docs/db-service.md) |
| **`appbase.storage`** | [Storage docs](./docs/storage-service.md) |

## Publishing / monorepo

Maintainers: see [`docs/PUBLISHING-SDK.md`](../../docs/PUBLISHING-SDK.md).
