# Storage service (`appbase.storage`)

Typed client for **API-SPEC §6** (`docs/API-SPEC.md` in the monorepo) — upload, list, download, and delete user-scoped files in buckets.

## Auth expectations

- Every call uses **`x-api-key`** (from `AppBase.init`) and **`Authorization: Bearer <access-token>`** only.
- **`auth.signIn` / `auth.signUp`** must run first so the SDK holds an access JWT (and browser session cookie for `/auth/refresh`).
- Before each storage request the SDK calls **`auth.ensureAccessToken()`**, which refreshes the JWT via **`POST /auth/refresh`** when it is near expiry (cookie-based). Storage requests themselves do **not** send refresh tokens in `Authorization`.

## Quick start

```ts
import { AppBase } from "@appbase/sdk";

const appbase = AppBase.init({
  endpoint: "http://localhost:3000",
  apiKey: process.env.APPBASE_API_KEY!,
  sessionStorageKey: "my_app", // browser: persist access slice + enable refresh
});

await appbase.auth.signIn({ email: "u@example.com", password: "…" });

const { file, url } = await appbase.storage.upload("avatars", fileInput, {
  filename: "profile.png",
});
```

## API

| Method | Description |
|--------|-------------|
| `upload(bucket, input, options?)` | `POST /storage/buckets/:bucket/upload`, multipart field **`file`**. |
| `list(bucket)` | `GET /storage/buckets/:bucket` → `{ files, total }`. |
| `download(bucket, fileId, options?)` | Binary `GET`; default **`Blob`** in browser, **`Buffer`** in Node (override with `{ as: "blob" \| "buffer" }`). |
| `remove(bucket, fileId)` | `DELETE ...`; alias **`delete`**. |
| `getUrl(bucket, fileId)` | Builds public path string (no I/O). |

### Upload inputs

| Environment | Accepted types |
|-------------|----------------|
| Browser | `File`, `Blob`, `FormData` (must include field **`file`**) |
| Node | `Buffer`, `Uint8Array`, **`Readable`** stream *(read fully into memory before send — avoid huge files in M1)* |

Options: `{ filename?, contentType? }` (ignored for `File` where `File.name` is used).

### Download outputs

- Default: `Blob` when `window` exists, else `Buffer`.
- Full response bodies are buffered in memory — large files should be handled carefully until streaming is added server/SDK-side.

### Types

- **`StorageFile`** — alias of `FileRecord`: `id`, `bucket`, `filename`, `mimeType`, `size`, `ownerId`, `createdAt`.
- **`StorageError`** — `name === "StorageError"`, `code` (e.g. `VALIDATION_ERROR`, `INVALID_TOKEN`, `NOT_FOUND`, `PAYLOAD_TOO_LARGE`), `status` (HTTP when available), `message`.

Checksum / version fields are **not** exposed until the public API contract includes them.

## Examples

### Browser — file input

```ts
const input = document.querySelector("input[type=file]") as HTMLInputElement;
const file = input.files?.[0];
if (!file) return;

const { file: meta, url } = await appbase.storage.upload("uploads", file);
console.log(meta.id, url);
```

### Browser — Blob

```ts
await appbase.storage.upload("docs", new Blob(["hello"], { type: "text/plain" }), {
  filename: "note.txt",
});
```

### Node — Buffer

```ts
import { AppBase } from "@appbase/sdk";
import fs from "node:fs";

const appbase = AppBase.init({
  endpoint: "http://127.0.0.1:3000",
  apiKey: process.env.APPBASE_API_KEY!,
});

await appbase.auth.signIn({ email: process.env.USER_EMAIL!, password: process.env.USER_PASSWORD! });

const buf = fs.readFileSync("./report.pdf");
await appbase.storage.upload("reports", buf, {
  filename: "report.pdf",
  contentType: "application/pdf",
});

const out = await appbase.storage.download("reports", fileId, { as: "buffer" });
fs.writeFileSync("./out.pdf", out);
```

### Node — stream (fully buffered)

```ts
import { createReadStream } from "node:fs";

await appbase.storage.upload("raw", createReadStream("./big.bin"), {
  filename: "big.bin",
  contentType: "application/octet-stream",
});
```

## Error handling

```ts
import { AppBase, StorageError } from "@appbase/sdk";

try {
  await appbase.storage.download("b", id, { as: "blob" });
} catch (e) {
  if (e instanceof StorageError) {
    console.error(e.code, e.message, e.status);
  }
  throw e;
}
```

Client-side checks (empty bucket, invalid `fileId` pattern) throw **`StorageError`** with code **`VALIDATION_ERROR`** before any network call.

## Server-side storage (ADR-005)

File bytes are stored by a **`StorageDriver`** on the server (default: filesystem under `STORAGE_ROOT`), not in the SDK. Deletes are not a single DB+FS transaction in M1; operational notes live in [`docs/STORAGE-OPERATIONS.md`](../../../docs/STORAGE-OPERATIONS.md) and [ADR-005](../../../docs/adr/ADR-005-file-storage-strategy.md).
