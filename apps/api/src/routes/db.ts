import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import { nanoid } from "nanoid";
import { eq, and, sql, count } from "drizzle-orm";
import { records, auditLog } from "@appbase/db/schema";
const COLLECTION_MAX_LENGTH = 64;
const COLLECTION_REGEX = /^[a-zA-Z0-9_-]+$/;

/** In-process pub/sub keyed by (collection, ownerId). M1: single instance only. */
type DbEvent = { type: "created" | "updated" | "deleted"; collection: string; record: SharedRecordPayload };
const dbEventBus = new Map<string, Set<(event: DbEvent) => void>>();

function busKey(collection: string, ownerId: string): string {
  return `${collection}:${ownerId}`;
}

function publish(collection: string, ownerId: string, event: DbEvent): void {
  const key = busKey(collection, ownerId);
  const listeners = dbEventBus.get(key);
  if (listeners) {
    for (const cb of listeners) cb(event);
  }
}

export function subscribe(
  collection: string,
  ownerId: string,
  callback: (event: DbEvent) => void,
): () => void {
  const key = busKey(collection, ownerId);
  let set = dbEventBus.get(key);
  if (!set) {
    set = new Set();
    dbEventBus.set(key, set);
  }
  set.add(callback);
  return () => {
    set!.delete(callback);
    if (set!.size === 0) dbEventBus.delete(key);
  };
}

type SharedRecordPayload = {
  id: string;
  collection: string;
  ownerId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function toRecordPayload(
  row: { id: string; collection: string; ownerId: string; data: Record<string, unknown>; createdAt: Date; updatedAt: Date },
): SharedRecordPayload {
  return {
    id: row.id,
    collection: row.collection,
    ownerId: row.ownerId,
    data: row.data,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function apiSuccess<T>(data: T) {
  return { success: true as const, data };
}

function apiError(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

function requireUserId(request: FastifyRequest): string | null {
  return (request as FastifyRequest & { userId?: string }).userId ?? null;
}

function validateCollection(name: string): { valid: boolean; error?: string } {
  if (typeof name !== "string" || name.length === 0) {
    return { valid: false, error: "Collection name is required" };
  }
  if (name.length > COLLECTION_MAX_LENGTH) {
    return { valid: false, error: `Collection name must be at most ${COLLECTION_MAX_LENGTH} characters` };
  }
  if (!COLLECTION_REGEX.test(name)) {
    return { valid: false, error: "Collection name may only contain letters, numbers, hyphens, and underscores" };
  }
  return { valid: true };
}

/** Parse filter as URL-encoded JSON object. M1: AND equality on top-level data keys only. */
const FILTER_KEY_REGEX = /^[a-zA-Z0-9_]+$/;

function parseFilter(filterStr: string | undefined): Record<string, unknown> | null {
  if (!filterStr) return null;
  try {
    const decoded = decodeURIComponent(filterStr);
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (!FILTER_KEY_REGEX.test(key)) return null;
    }
    return obj;
  } catch {
    return null;
  }
}

export async function registerDbRoutes(app: FastifyInstance) {
  await app.register(
    async (instance) => {
      const db = instance.db;

      // POST /db/collections/:collection
      instance.post<{
        Params: { collection: string };
        Body: { data?: unknown };
      }>("/collections/:collection", async (request, reply) => {
        const userId = requireUserId(request);
        if (!userId) {
          return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
        }

        const { collection } = request.params;
        const collCheck = validateCollection(collection);
        if (!collCheck.valid) {
          return reply.status(400).send(apiError("VALIDATION_ERROR", collCheck.error!));
        }

        const body = request.body;
        if (!body || typeof body !== "object") {
          return reply.status(400).send(apiError("VALIDATION_ERROR", "Request body must be an object"));
        }
        const data = body.data;
        if (data === undefined || data === null) {
          return reply.status(400).send(apiError("VALIDATION_ERROR", "Field 'data' is required"));
        }
        if (typeof data !== "object" || Array.isArray(data)) {
          return reply.status(400).send(apiError("VALIDATION_ERROR", "Field 'data' must be a JSON object"));
        }

        const id = nanoid();
        const now = new Date();

        await db.insert(records).values({
          id,
          collection,
          ownerId: userId,
          data: data as Record<string, unknown>,
          createdAt: now,
          updatedAt: now,
        });

        await db.insert(auditLog).values({
          id: randomUUID(),
          action: "record.create",
          userId,
          resource: "records",
          resourceId: id,
          metadata: { collection },
          createdAt: now,
        });

        const inserted = await db
          .select()
          .from(records)
          .where(and(eq(records.id, id), eq(records.ownerId, userId)))
          .limit(1);

        const record = inserted[0];
        if (!record) {
          return reply.status(500).send(apiError("INTERNAL_ERROR", "Failed to read created record"));
        }

        const payload = toRecordPayload(record);
        publish(collection, userId, { type: "created", collection, record: payload });

        return reply.status(201).send(apiSuccess(payload));
      });

      // GET /db/collections/:collection/subscribe — must be before :id
      instance.get<{ Params: { collection: string } }>("/collections/:collection/subscribe", async (request, reply) => {
        const userId = requireUserId(request);
        if (!userId) {
          return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
        }

        const { collection } = request.params;
        const collCheck = validateCollection(collection);
        if (!collCheck.valid) {
          return reply.status(400).send(apiError("VALIDATION_ERROR", collCheck.error!));
        }

        reply.hijack();
        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        reply.raw.flushHeaders();

        const send = (event: DbEvent) => {
          const line = `event: ${event.type}\ndata: ${JSON.stringify({ type: event.type, collection: event.collection, record: event.record })}\n\n`;
          reply.raw.write(line);
        };

        const unsub = subscribe(collection, userId, send);

        request.raw.on("close", () => {
          unsub();
        });
      });

      // GET /db/collections/:collection
      instance.get<{
        Params: { collection: string };
        Querystring: { limit?: string; offset?: string; filter?: string };
      }>("/collections/:collection", async (request, reply) => {
        const userId = requireUserId(request);
        if (!userId) {
          return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
        }

        const { collection } = request.params;
        const collCheck = validateCollection(collection);
        if (!collCheck.valid) {
          return reply.status(400).send(apiError("VALIDATION_ERROR", collCheck.error!));
        }

        const limit = Math.min(Math.max(1, parseInt(request.query.limit ?? "50", 10)), 100);
        const offset = Math.max(0, parseInt(request.query.offset ?? "0", 10));
        const filter = parseFilter(request.query.filter);

        const conditions = [eq(records.collection, collection), eq(records.ownerId, userId)];

        if (filter && Object.keys(filter).length > 0) {
          for (const [key, value] of Object.entries(filter)) {
            if (value === undefined) continue;
            if (!FILTER_KEY_REGEX.test(key)) continue;
            const path = `$.${key}`;
            const sqlValue =
              typeof value === "boolean" ? (value ? 1 : 0) : value;
            conditions.push(sql`json_extract(${records.data}, ${path}) = ${sqlValue}`);
          }
        }

        const where = conditions.length === 1 ? conditions[0]! : and(...conditions);

        const [rows, totalResult] = await Promise.all([
          db.select().from(records).where(where).orderBy(records.createdAt).limit(limit).offset(offset),
          db.select({ count: count() }).from(records).where(where),
        ]);

        const total = totalResult[0]?.count ?? 0;
        const items = rows.map(toRecordPayload);

        return reply.send(apiSuccess({ items, total }));
      });

      // GET /db/collections/:collection/:id
      instance.get<{ Params: { collection: string; id: string } }>(
        "/collections/:collection/:id",
        async (request, reply) => {
          const userId = requireUserId(request);
          if (!userId) {
            return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
          }

          const { collection, id } = request.params;
          const collCheck = validateCollection(collection);
          if (!collCheck.valid) {
            return reply.status(400).send(apiError("VALIDATION_ERROR", collCheck.error!));
          }

          const rows = await db
            .select()
            .from(records)
            .where(and(eq(records.id, id), eq(records.collection, collection), eq(records.ownerId, userId)))
            .limit(1);

          if (rows.length === 0) {
            return reply.status(404).send(apiError("NOT_FOUND", "Record not found"));
          }

          return reply.send(apiSuccess(toRecordPayload(rows[0]!)));
        },
      );

      // PUT /db/collections/:collection/:id
      instance.put<{
        Params: { collection: string; id: string };
        Body: { data?: unknown };
      }>("/collections/:collection/:id", async (request, reply) => {
        const userId = requireUserId(request);
        if (!userId) {
          return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
        }

        const { collection, id } = request.params;
        const collCheck = validateCollection(collection);
        if (!collCheck.valid) {
          return reply.status(400).send(apiError("VALIDATION_ERROR", collCheck.error!));
        }

        const body = request.body;
        if (!body || typeof body !== "object") {
          return reply.status(400).send(apiError("VALIDATION_ERROR", "Request body must be an object"));
        }
        const data = body.data;
        if (data === undefined || data === null) {
          return reply.status(400).send(apiError("VALIDATION_ERROR", "Field 'data' is required"));
        }
        if (typeof data !== "object" || Array.isArray(data)) {
          return reply.status(400).send(apiError("VALIDATION_ERROR", "Field 'data' must be a JSON object"));
        }

        const existing = await db
          .select()
          .from(records)
          .where(and(eq(records.id, id), eq(records.collection, collection), eq(records.ownerId, userId)))
          .limit(1);

        if (existing.length === 0) {
          return reply.status(404).send(apiError("NOT_FOUND", "Record not found"));
        }

        const now = new Date();
        await db
          .update(records)
          .set({ data: data as Record<string, unknown>, updatedAt: now })
          .where(and(eq(records.id, id), eq(records.ownerId, userId)));

        await db.insert(auditLog).values({
          id: randomUUID(),
          action: "record.update",
          userId,
          resource: "records",
          resourceId: id,
          metadata: { collection },
          createdAt: now,
        });

        const updated = await db
          .select()
          .from(records)
          .where(and(eq(records.id, id), eq(records.ownerId, userId)))
          .limit(1);

        const record = updated[0]!;
        const payload = toRecordPayload(record);
        publish(collection, userId, { type: "updated", collection, record: payload });

        return reply.send(apiSuccess(payload));
      });

      // DELETE /db/collections/:collection/:id
      instance.delete<{ Params: { collection: string; id: string } }>(
        "/collections/:collection/:id",
        async (request, reply) => {
          const userId = requireUserId(request);
          if (!userId) {
            return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
          }

          const { collection, id } = request.params;
          const collCheck = validateCollection(collection);
          if (!collCheck.valid) {
            return reply.status(400).send(apiError("VALIDATION_ERROR", collCheck.error!));
          }

          const existing = await db
            .select()
            .from(records)
            .where(and(eq(records.id, id), eq(records.collection, collection), eq(records.ownerId, userId)))
            .limit(1);

          if (existing.length === 0) {
            return reply.status(404).send(apiError("NOT_FOUND", "Record not found"));
          }

          await db
            .delete(records)
            .where(and(eq(records.id, id), eq(records.collection, collection), eq(records.ownerId, userId)));

          await db.insert(auditLog).values({
            id: randomUUID(),
            action: "record.delete",
            userId,
            resource: "records",
            resourceId: id,
            metadata: { collection },
            createdAt: new Date(),
          });

          const payload = { id, collection, ownerId: userId, data: existing[0]!.data, createdAt: existing[0]!.createdAt, updatedAt: existing[0]!.updatedAt };
          publish(collection, userId, { type: "deleted", collection, record: toRecordPayload(payload) });

          return reply.send(apiSuccess({ deleted: true }));
        },
      );
    },
    { prefix: "/db" },
  );
}
