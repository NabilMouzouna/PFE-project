# AppBase — Public API Specification

> This document defines the **public AppBase contract**: the request formats, response schemas, headers, and error model that SDKs, demo applications, and third-party clients rely on. Internal implementation details such as `better-auth` route wiring or dashboard-only auth are intentionally out of scope.

---

## 1. Scope

This specification covers the public BaaS API exposed by `apps/api/`:

- Authentication endpoints under `/auth/*`
- Storage endpoints under `/storage/*`
- Database endpoints under `/db/*`
- Standard success and error response envelopes
- Public authentication header rules

This specification does **not** cover dashboard-internal authentication. The app-specific dashboard is an internal browser UI and may use a separate, simpler authentication mechanism such as secure cookie-based sessions.

---

## 2. Base URL

### M1

- API base URL: `http://localhost:3000`

### M2+

- API base URL: `https://api.<app>.appbase.local`

The public contract is stable across both phases; only the base URL changes.

---

## 3. Authentication and Headers

### 3.1 Client profiles (how the session / refresh is carried)

The **access token** is always a JWT sent as `Authorization: Bearer <access-token>` on `/storage/*` and `/db/*`.

The **session** (refresh credential) can be carried in two ways:

| Profile | Typical client | Session on `/auth/refresh` and `/auth/logout` | Browser `fetch` |
|---|---|---|---|
| **Bearer** | Node, automation, non-browser SDKs | `Authorization: Bearer <session-token>` (from `refreshToken` in login/register JSON) | Default: no cookies |
| **Browser cookie** (recommended default for SPAs) | First-party browser apps | Valid **session cookie** (set on login/register); client sends **`credentials: 'include'`** | Required on `/auth/*` |

The client selects the profile in configuration (e.g. SDK `authTransport: 'bearer' | 'cookie'`). The server **may** emit `Set-Cookie` even when the client uses Bearer; Bearer clients **should** ignore that cookie if they persist `refreshToken` from JSON.

**LAN / HTTP:** Until the API is served over HTTPS, the session cookie **must not** use the `Secure` flag (browsers will not send it on `http://`). **`HttpOnly` does not require HTTPS** — implementations **should** use `HttpOnly` when the stack supports cookie-only refresh reliably; if not, a **non-`HttpOnly`** session cookie is allowed as a **transitional** mode (XSS can read it — document risk). When HTTPS is enabled, tighten to **`HttpOnly` + `Secure`** and re-evaluate `SameSite`. See ADR-003 (amendment 2026-03-20).

**CORS (cookie profile):** Responses **must** include `Access-Control-Allow-Credentials: true` and a **specific** `Access-Control-Allow-Origin` (never `*` with credentials). Allowed origins are instance configuration.

### 3.2 Header Types

| Header | Format | Used For |
|---|---|---|
| `x-api-key` | `hs_live_<token>` | Identifies the app/BaaS instance |
| `Authorization` | `Bearer <session-token>` | Session lifecycle when using **Bearer profile** (`/auth/refresh`, `/auth/logout`) |
| `Authorization` | `Bearer <access-token>` | Protected storage and database operations |
| `Cookie` | `appbase_session=...` | Session lifecycle when using **Browser cookie profile** (browser sends automatically) |

Public session cookie name **SHOULD** be `appbase_session` unless operators are documented otherwise.

### 3.3 Rules by Endpoint Group

| Endpoint Group | Required credentials |
|---|---|
| `POST /auth/register` | none |
| `POST /auth/login` | none |
| `POST /auth/refresh` | **Bearer:** `Authorization: Bearer <session-token>` **or** **Cookie:** valid session cookie + `credentials: 'include'` |
| `POST /auth/logout` | Same as refresh |
| `/storage/*` | `x-api-key` + `Authorization: Bearer <access-token>` |
| `/db/*` | `x-api-key` + `Authorization: Bearer <access-token>` |

### 3.4 Token Semantics

- **Session token** (Bearer profile): opaque token used only for refresh and logout; returned as `refreshToken` in JSON.
- **Session cookie** (Browser cookie profile): server-set cookie carrying the same session; **not** sent on `/storage/*` or `/db/*` unless misconfigured — access still uses the JWT.
- **Access token**: short-lived JWT for protected BaaS operations.
- **API key**: app-scoped key required on all storage and database requests.

The SDK is responsible for attaching the correct headers/credentials per profile. **Do not** persist `refreshToken` in `localStorage` when using **Browser cookie profile**; rely on the cookie for refresh.

---

## 4. Standard Response Format

All JSON endpoints return one of the following envelopes.

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The provided access token is invalid or expired."
  }
}
```

### Error Code Set

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Request body, params, or query is invalid |
| `INVALID_CREDENTIALS` | Email/password pair is invalid |
| `INVALID_API_KEY` | `x-api-key` is missing or invalid |
| `INVALID_TOKEN` | Bearer token is missing, invalid, or expired |
| `FORBIDDEN` | Authenticated but not allowed to perform operation |
| `NOT_FOUND` | Requested resource does not exist |
| `CONFLICT` | Resource already exists or unique constraint violation |
| `PAYLOAD_TOO_LARGE` | Uploaded file exceeds limits |
| `INTERNAL_ERROR` | Unexpected server failure |

---

## 5. Auth Endpoints

> Auth is implemented internally with `better-auth`, but the routes below are the stable public AppBase contract.

**Browser cookie profile:** On successful `/auth/register` and `/auth/login`, the server **sets** a session `Set-Cookie`. Clients **must** use `credentials: 'include'` on `/auth/refresh` and `/auth/logout`. `refreshToken` in JSON **may be omitted** in this profile.

**Bearer profile:** Responses include `refreshToken` in JSON; `/auth/refresh` and `/auth/logout` require `Authorization: Bearer <session-token>`.

### 5.1 POST `/auth/register`

Creates a new user account for the current app.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Schema**

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes | Must be a valid email address |
| `password` | string | yes | Plaintext password, hashed server-side |

**Success response**

**Headers:** May include `Set-Cookie` for the session (**Browser cookie profile**).

```json
{
  "success": true,
  "data": {
    "accessToken": "atk_...",
    "refreshToken": "stk_...",
    "expiresIn": 900,
    "user": {
      "id": "usr_123",
      "email": "user@example.com",
      "createdAt": "2026-03-17T10:00:00.000Z",
      "updatedAt": "2026-03-17T10:00:00.000Z"
    }
  }
}
```

In **Browser cookie profile**, `refreshToken` **may be omitted** or `null`. `accessToken` and `expiresIn` remain for `Authorization` on `/storage/*` and `/db/*`.

### 5.2 POST `/auth/login`

Authenticates a user and issues a new session.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Schema**

| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `password` | string | yes |

**Success response**

Same schema as `POST /auth/register` (including optional omission of `refreshToken` under Browser cookie profile).

**Headers:** May include `Set-Cookie` (session established or rotated).

### 5.3 POST `/auth/refresh`

Refreshes the access token using a valid session (**Bearer** or **cookie**).

**Bearer profile — headers**

```http
Authorization: Bearer <session-token>
```

**Browser cookie profile — headers**

No `Authorization` required when a valid session cookie is sent. Use `fetch(..., { credentials: 'include' })` so the browser attaches `Cookie`.

**Request body**

No body.

**Success response**

```json
{
  "success": true,
  "data": {
    "accessToken": "atk_...",
    "expiresIn": 900
  }
}
```

**Headers:** May include `Set-Cookie` if the implementation rotates the session cookie.

In **Bearer profile**, the response **may** include a new `refreshToken` if the server rotates the session token (optional; clients should persist when present).

### 5.4 POST `/auth/logout`

Revokes the active session.

**Bearer profile — headers**

```http
Authorization: Bearer <session-token>
```

**Browser cookie profile**

`POST` with `credentials: 'include'`; session identified by cookie. `Authorization` is optional if the cookie is present.

**Request body**

No body.

**Success response**

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

### 5.5 Password Reset in M1

Password reset is **not part of the public MVP API contract**. In M1 it is handled through the app-specific dashboard as an admin-mediated operation.

If a self-service reset flow is introduced later, it will be added as a new public auth endpoint without changing the rest of the contract.

---

## 6. Storage Endpoints

### Shared Storage Object

```json
{
  "id": "file_123",
  "bucket": "avatars",
  "filename": "profile.png",
  "mimeType": "image/png",
  "size": 24512,
  "ownerId": "usr_123",
  "createdAt": "2026-03-17T10:00:00.000Z"
}
```

### 6.1 POST `/storage/buckets/:bucket/upload`

Uploads a file to a bucket scoped to the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
```

**Path parameters**

| Param | Type | Notes |
|---|---|---|
| `bucket` | string | Bucket name chosen by the app developer |

**Form fields**

| Field | Type | Required |
|---|---|---|
| `file` | binary | yes |

**Success response**

```json
{
  "success": true,
  "data": {
    "file": {
      "id": "file_123",
      "bucket": "avatars",
      "filename": "profile.png",
      "mimeType": "image/png",
      "size": 24512,
      "ownerId": "usr_123",
      "createdAt": "2026-03-17T10:00:00.000Z"
    },
    "url": "/storage/buckets/avatars/file_123"
  }
}
```

### 6.2 GET `/storage/buckets/:bucket`

Lists files in a bucket belonging to the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
```

**Success response**

```json
{
  "success": true,
  "data": {
    "files": [],
    "total": 0
  }
}
```

### 6.3 GET `/storage/buckets/:bucket/:fileId`

Downloads a file owned by the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
```

**Success response**

Binary file stream. `Content-Type` matches the stored `mimeType`.

### 6.4 DELETE `/storage/buckets/:bucket/:fileId`

Deletes a file owned by the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
```

**Success response**

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

---

## 7. Database Endpoints

### Shared Record Object

```json
{
  "id": "rec_123",
  "collection": "passwords",
  "ownerId": "usr_123",
  "data": {
    "site": "github.com",
    "username": "amina",
    "encrypted": "..."
  },
  "createdAt": "2026-03-17T10:00:00.000Z",
  "updatedAt": "2026-03-17T10:00:00.000Z"
}
```

### 7.1 POST `/db/collections/:collection`

Creates a record in the specified collection.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request body**

```json
{
  "data": {
    "site": "github.com",
    "username": "amina",
    "encrypted": "..."
  }
}
```

**Success response**

```json
{
  "success": true,
  "data": {
    "id": "rec_123",
    "collection": "passwords",
    "ownerId": "usr_123",
    "data": {
      "site": "github.com",
      "username": "amina",
      "encrypted": "..."
    },
    "createdAt": "2026-03-17T10:00:00.000Z",
    "updatedAt": "2026-03-17T10:00:00.000Z"
  }
}
```

### 7.2 GET `/db/collections/:collection`

Lists records in a collection for the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
```

**Query parameters**

| Param | Type | Required | Notes |
|---|---|---|---|
| `limit` | number | no | Maximum number of records |
| `offset` | number | no | Pagination offset |
| `filter` | string | no | Filter expression or JSON-encoded filter object |

**Success response**

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0
  }
}
```

### 7.3 GET `/db/collections/:collection/:id`

Gets one record by ID.

### 7.4 PUT `/db/collections/:collection/:id`

Updates one record by ID.

**Request body**

```json
{
  "data": {
    "site": "gitlab.com",
    "username": "amina",
    "encrypted": "..."
  }
}
```

### 7.5 DELETE `/db/collections/:collection/:id`

Deletes one record by ID.

### 7.6 Common Response Schema for 7.3 / 7.4

```json
{
  "success": true,
  "data": {
    "id": "rec_123",
    "collection": "passwords",
    "ownerId": "usr_123",
    "data": {
      "site": "gitlab.com",
      "username": "amina",
      "encrypted": "..."
    },
    "createdAt": "2026-03-17T10:00:00.000Z",
    "updatedAt": "2026-03-17T10:05:00.000Z"
  }
}
```

### 7.7 Common Success Schema for 7.5

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

### 7.8 GET `/db/collections/:collection/subscribe`

Opens an SSE stream for real-time changes in a collection.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
Accept: text/event-stream
```

**SSE event format**

```text
event: created
data: {"type":"created","collection":"passwords","record":{"id":"rec_123","site":"github.com","username":"amina","encrypted":"..."}}
```

**Allowed event types**

- `created`
- `updated`
- `deleted`

---

## 8. Notes for Alignment

- This file defines the public AppBase contract.
- `docs/ARCHITECTURE.md` explains how that contract is hosted and routed.
- `better-auth` is an internal implementation choice, not the public route namespace; the **Browser cookie profile** may map to better-auth’s session cookie internally while the **public** behavior (CORS, optional `refreshToken` in JSON, LAN-safe cookie flags) is defined here and in ADR-003.
- Dashboard authentication is intentionally separate from the public API contract.
