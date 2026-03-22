# Database Service

AppBase’s document-style database: **collections** (named groups of records), optional **Zod schemas** for typed CRUD, and **real-time subscriptions**.

**Headers:** All `/db/`* requests use `x-api-key` and `Authorization: Bearer <access-token>`. The access token is a short-lived JWT from login/register — not the refresh/session token.

---

## Quick start

```ts
import { AppBase } from "@appbase/sdk";
import { z } from "zod";

const appbase = AppBase.init({
  endpoint: "http://localhost:3000",
  apiKey: "hs_live_your_key",
  sessionStorageKey: "my_app_session",
});

const TodoSchema = z.object({
  title: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
});

type TodoData = z.infer<typeof TodoSchema>;

const todos = appbase.db.collection<TodoData>("todos", TodoSchema);

// Create
const created = await todos.create({
  title: "Ship feature",
  done: false,
  createdAt: new Date().toISOString(),
});

// List
const { items, total } = await todos.list({ limit: 20 });

// Get one
const one = await todos.get(created.id);

// Update (partial — merged with existing)
await todos.update(created.id, { done: true });

// Delete
await todos.delete(created.id);
```

---

## Collection API


| Method                | Description                                                                   |
| --------------------- | ----------------------------------------------------------------------------- |
| `create(data)`        | Create a record. Validates with schema if provided. Returns full record.      |
| `list(options?)`      | List records. Options: `limit`, `offset`, `filter` (equality on data fields). |
| `get(id)`             | Get one record. Throws `DbError` with code `NOT_FOUND` if missing.            |
| `update(id, data)`    | Update a record. Partial data is merged with existing.                        |
| `delete(id)`          | Delete a record. Throws `DbError` with code `NOT_FOUND` if missing.           |
| `remove(id)`          | Alias for `delete`.                                                           |
| `subscribe(callback)` | Subscribe to real-time changes. Returns `unsubscribe` function.               |


---

## Schemas (Zod)

Pass a Zod schema as the second argument for typed CRUD:

```ts
const todos = appbase.db.collection<TodoData>("todos", TodoSchema);
```

- **Create:** Payload is validated before sending.
- **List / Get:** `data` is parsed through the schema; invalid items surface as parse errors.
- **Update:** Merged payload is validated before sending.

Without a schema, `data` is untyped `Record<string, unknown>`.

---

## List options

```ts
const { items, total } = await todos.list({
  limit: 10,
  offset: 0,
  filter: { done: false },  // AND equality on top-level data keys
});
```

---

## References

References are **string IDs** in `data`, e.g. `blogId`, `authorId`. There is no server-side join; cascade and orphans are handled in your app.

Example:

```ts
const CommentSchema = z.object({
  text: z.string(),
  blogId: z.string(),   // reference to blogs collection
  authorId: z.string(), // reference to users
  createdAt: z.string(),
});
```

To list comments for a blog:

```ts
const comments = await appbase.db
  .collection<CommentData>("comments", CommentSchema)
  .list({ filter: { blogId: someBlogId } });
```

---

## Real-time (subscribe)

```ts
const unsub = todos.subscribe((event) => {
  switch (event.type) {
    case "created":
      console.log("New:", event.record);
      break;
    case "updated":
      console.log("Updated:", event.record);
      break;
    case "deleted":
      console.log("Deleted:", event.record.id);
      break;
  }
});

// Later
unsub();
```

The subscription uses fetch + ReadableStream so it can send the Bearer token (unlike EventSource).

---

## Error handling

```ts
import { DbError } from "@appbase/sdk";

try {
  await todos.get("missing-id");
} catch (err) {
  if (err instanceof DbError && err.code === "NOT_FOUND") {
    console.log("Record not found");
  } else {
    throw err;
  }
}
```

Common codes: `NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_TOKEN`, `INVALID_API_KEY`.

---

## Blog example

```ts
import { z } from "zod";
import { AppBase } from "@appbase/sdk";

const appbase = AppBase.init({ endpoint: "...", apiKey: "...", sessionStorageKey: "..." });

const BlogSchema = z.object({
  title: z.string(),
  slug: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

const CommentSchema = z.object({
  blogId: z.string(),
  authorId: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

type BlogData = z.infer<typeof BlogSchema>;
type CommentData = z.infer<typeof CommentSchema>;

const blogs = appbase.db.collection<BlogData>("blogs", BlogSchema);
const comments = appbase.db.collection<CommentData>("comments", CommentSchema);

// Create a blog
const blog = await blogs.create({
  title: "Hello World",
  slug: "hello-world",
  body: "...",
  createdAt: new Date().toISOString(),
});

// Add a comment (reference by id)
await comments.create({
  blogId: blog.id,
  authorId: "usr_123",
  text: "Great post!",
  createdAt: new Date().toISOString(),
});

// List comments for this blog
const { items } = await comments.list({ filter: { blogId: blog.id } });
```

---

## Limitations

- **No server-side joins** — references are IDs only; fetching related data is done in your app.
- **No cascade delete** — deleting a blog does not delete its comments.
- **Filter:** M1 supports only equality on top-level `data` keys (AND).

