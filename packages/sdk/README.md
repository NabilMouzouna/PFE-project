# @appbase/sdk

JavaScript/TypeScript SDK for AppBase services.

## Quick start

```ts
import { AppBase } from "@appbase/sdk";

const appbase = AppBase.init({
  endpoint: "http://localhost:3000",
  apiKey: "hs_live_your_instance_api_key",
});
```

The SDK currently exposes:

- `appbase.auth` (implemented)
- `appbase.db` (placeholder docs for now)
- `appbase.storage` (placeholder docs for now)

## Auth (implemented)

`AuthClient` talks to:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Sign up

```ts
const session = await appbase.auth.signUp({
  email: "user@example.com",
  password: "SecurePassword123!",
  customIdentity: {
    displayName: "User",
  },
});

console.log(session.accessToken);
console.log(session.refreshToken);
```

### Sign in

```ts
const session = await appbase.auth.signIn({
  email: "user@example.com",
  password: "SecurePassword123!",
});
```

### Refresh access token

```ts
const refreshed = await appbase.auth.refresh();
console.log(refreshed.accessToken);
```

### Sign out

```ts
await appbase.auth.signOut();
```

### Session helpers

```ts
const session = appbase.auth.getSession(); // Session | null
const accessToken = appbase.auth.getAccessToken(); // string | null
```

### Notes

- `AuthClient` stores session in memory only.
- `refresh()` and `signOut()` require an active in-memory session.
- Server API key validation is handled by the backend; SDK sends auth payloads only for auth routes.

## DB (placeholder)

DB client API exists in `src/db.ts`, but usage docs are intentionally postponed until DB service/API is finalized.

## Storage (placeholder)

Storage client API exists in `src/storage.ts`, but usage docs are intentionally postponed until Storage service/API is finalized.
