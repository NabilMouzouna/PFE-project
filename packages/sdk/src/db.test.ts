import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { DbClient, DbError } from "./db";
import type { AuthClient } from "./auth";

const mockAuth: AuthClient = {
  getAccessToken: () => "mock-token",
} as AuthClient;

const mockConfig = {
  endpoint: "http://api.test",
  apiKey: "hs_live_test",
};

describe("DbClient / CollectionRef", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("create sends { data } body and returns typed record", async () => {
    const TodoSchema = z.object({ title: z.string(), done: z.boolean() });
    type Todo = z.infer<typeof TodoSchema>;

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "rec_1",
          collection: "todos",
          ownerId: "usr_1",
          data: { title: "Test", done: false },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection<Todo>("todos", TodoSchema);
    const result = await col.create({ title: "Test", done: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/db/collections/todos",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ data: { title: "Test", done: false } }),
        headers: expect.objectContaining({
          "x-api-key": "hs_live_test",
          Authorization: "Bearer mock-token",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result.id).toBe("rec_1");
    expect(result.data.title).toBe("Test");
    expect(result.data.done).toBe(false);
  });

  it("create throws on Zod validation failure", async () => {
    const TodoSchema = z.object({ title: z.string(), done: z.boolean() });
    type Todo = z.infer<typeof TodoSchema>;

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection<Todo>("todos", TodoSchema);

    await expect(col.create({ title: "Ok", done: "not-a-bool" as unknown as boolean })).rejects.toThrow(z.ZodError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("list returns typed items with schema parsing", async () => {
    const TodoSchema = z.object({ title: z.string(), done: z.boolean() });
    type Todo = z.infer<typeof TodoSchema>;

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [
            {
              id: "rec_1",
              collection: "todos",
              ownerId: "usr_1",
              data: { title: "A", done: false },
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          total: 1,
        },
      }),
    });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection<Todo>("todos", TodoSchema);
    const { items, total } = await col.list({ limit: 10, filter: { done: false } });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/db/collections/todos?limit=10&filter=%7B%22done%22%3Afalse%7D",
      expect.any(Object),
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.data.title).toBe("A");
    expect(total).toBe(1);
  });

  it("throws DbError with code on API error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({
          success: false,
          error: { code: "NOT_FOUND", message: "Record not found" },
        }),
    });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection("todos");

    await expect(col.get("missing")).rejects.toMatchObject({
      name: "DbError",
      code: "NOT_FOUND",
      message: "Record not found",
    });
  });

  it("get returns typed record", async () => {
    const TodoSchema = z.object({ title: z.string(), done: z.boolean() });
    type Todo = z.infer<typeof TodoSchema>;

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "rec_1",
          collection: "todos",
          ownerId: "usr_1",
          data: { title: "Single", done: true },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection<Todo>("todos", TodoSchema);
    const result = await col.get("rec_1");

    expect(result.id).toBe("rec_1");
    expect(result.data.title).toBe("Single");
    expect(result.data.done).toBe(true);
  });

  it("delete sends DELETE and returns void", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { deleted: true } }),
    });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection("todos");
    await col.delete("rec_1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/db/collections/todos/rec_1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("remove is alias for delete", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { deleted: true } }),
    });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection("todos");
    await col.remove("rec_1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("list without options uses default params", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: [], total: 0 } }),
    });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection("items");
    const { items, total } = await col.list();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/db/collections/items",
      expect.any(Object),
    );
    expect(items).toEqual([]);
    expect(total).toBe(0);
  });

  it("list without schema returns untyped data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [
            {
              id: "rec_1",
              collection: "x",
              ownerId: "u",
              data: { foo: "bar" },
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          total: 1,
        },
      }),
    });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection("items");
    const { items } = await col.list();
    expect(items[0]!.data).toEqual({ foo: "bar" });
  });

  it("update merges partial with existing", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "rec_1",
            collection: "todos",
            ownerId: "usr_1",
            data: { title: "Original", done: false },
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "rec_1",
            collection: "todos",
            ownerId: "usr_1",
            data: { title: "Original", done: true },
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        }),
      });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection("todos");
    const result = await col.update("rec_1", { done: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ data: { title: "Original", done: true } }),
    });
    expect(result.data.done).toBe(true);
  });

  it("list returns from cache when dbCache enabled", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [], total: 0 },
      }),
    });

    const db = new DbClient(mockConfig, mockAuth, true);
    const col = db.collection("items");

    const r1 = await col.list({ limit: 10 });
    const r2 = await col.list({ limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it("list cache invalidated on create", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { items: [], total: 0 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "rec_1",
            collection: "items",
            ownerId: "u",
            data: {},
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { items: [{ id: "rec_1", collection: "items", ownerId: "u", data: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }], total: 1 },
        }),
      });

    const db = new DbClient(mockConfig, mockAuth, true);
    const col = db.collection("items");

    await col.list({ limit: 10 });
    await col.create({});
    const { items } = await col.list({ limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(items).toHaveLength(1);
  });

  it("subscribe calls fetch with auth headers and parses SSE events", async () => {
    const eventData = { type: "created" as const, collection: "todos", record: { id: "rec_1", title: "New" } };
    const sseBody = `event: created\ndata: ${JSON.stringify(eventData)}\n\n`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseBody));
        controller.close();
      },
    });

    fetchMock.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const db = new DbClient(mockConfig, mockAuth, false);
    const col = db.collection("todos");
    const events: unknown[] = [];
    const unsub = col.subscribe((e) => events.push(e));

    await new Promise((r) => setTimeout(r, 50));
    unsub();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/db/collections/todos/subscribe",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-token",
          "x-api-key": "hs_live_test",
        }),
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "created", collection: "todos", record: { id: "rec_1" } });
  });
});
