# @appbase/sdk

JavaScript/TypeScript SDK for AppBase.

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
```

## Services

| Service | Status |
|---------|--------|
| **`appbase.auth`** | [Auth docs](./docs/auth-service.md) |
| **`appbase.db`** | Placeholder |
| **`appbase.storage`** | Placeholder |
