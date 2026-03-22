import { describe, expect, it, beforeEach, beforeAll, afterAll } from "vitest";

import { buildApp } from "../app";
import { loadEnv } from "../config/env";

async function createTestUser(app: Awaited<ReturnType<typeof buildApp>>): Promise<{
  accessToken: string;
  userId: string;
}> {
  const registerRes = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: `db-test-${Date.now()}@example.com`, password: "SecurePassword123!" },
  });
  expect(registerRes.statusCode).toBe(201);
  const { data } = registerRes.json() as { data: { accessToken: string; user: { id: string } } };
  return { accessToken: data.accessToken, userId: data.user.id };
}

describe("db routes", () => {
  const port = 38472 + (Math.floor(Math.random() * 1000) % 1000);
  const baseUrl = `http://127.0.0.1:${port}`;

  const testEnv = loadEnv({
    ...process.env,
    NODE_ENV: "test",
    DB_PATH: ":memory:",
    AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
    BASE_URL: baseUrl,
  });

  let app: Awaited<ReturnType<typeof buildApp>>;
  let accessToken: string;

  beforeAll(async () => {
    app = await buildApp({ env: testEnv });
    await app.listen({ port, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const creds = await createTestUser(app);
    accessToken = creds.accessToken;
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  });

  it("POST /db/collections/:collection - create record", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/db/collections/todos",
      headers: authHeaders(),
      payload: { data: { title: "Buy milk", done: false } },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: expect.any(String),
      collection: "todos",
      data: { title: "Buy milk", done: false },
    });
    expect(body.data.ownerId).toBeDefined();
    expect(body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("GET /db/collections/:collection - list records", async () => {
    await app.inject({
      method: "POST",
      url: "/db/collections/notes",
      headers: authHeaders(),
      payload: { data: { text: "Note 1" } },
    });
    await app.inject({
      method: "POST",
      url: "/db/collections/notes",
      headers: authHeaders(),
      payload: { data: { text: "Note 2" } },
    });

    const res = await app.inject({
      method: "GET",
      url: "/db/collections/notes",
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(2);
  });

  it("GET /db/collections/:collection/:id - get one record", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/db/collections/items",
      headers: authHeaders(),
      payload: { data: { name: "Item 1" } },
    });
    const id = (createRes.json() as { data: { id: string } }).data.id;

    const res = await app.inject({
      method: "GET",
      url: `/db/collections/items/${id}`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(id);
    expect(body.data.data).toEqual({ name: "Item 1" });
  });

  it("PUT /db/collections/:collection/:id - update record", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/db/collections/tasks",
      headers: authHeaders(),
      payload: { data: { label: "Original" } },
    });
    const id = (createRes.json() as { data: { id: string } }).data.id;

    const res = await app.inject({
      method: "PUT",
      url: `/db/collections/tasks/${id}`,
      headers: authHeaders(),
      payload: { data: { label: "Updated" } },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.data.label).toBe("Updated");
  });

  it("DELETE /db/collections/:collection/:id - delete record", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/db/collections/temp",
      headers: authHeaders(),
      payload: { data: { x: 1 } },
    });
    const id = (createRes.json() as { data: { id: string } }).data.id;

    const res = await app.inject({
      method: "DELETE",
      url: `/db/collections/temp/${id}`,
      headers: { Authorization: authHeaders().Authorization },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.deleted).toBe(true);

    const getRes = await app.inject({
      method: "GET",
      url: `/db/collections/temp/${id}`,
      headers: authHeaders(),
    });
    expect(getRes.statusCode).toBe(404);
  });

  it("user isolation - user B cannot read user A record", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/db/collections/private",
      headers: authHeaders(),
      payload: { data: { secret: "user-a-data" } },
    });
    const id = (createRes.json() as { data: { id: string } }).data.id;

    const userBRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: `user-b-${Date.now()}@example.com`, password: "SecurePassword123!" },
    });
    const userBData = (userBRes.json() as { data: { accessToken: string } }).data;

    const getRes = await app.inject({
      method: "GET",
      url: `/db/collections/private/${id}`,
      headers: { Authorization: `Bearer ${userBData.accessToken}` },
    });

    expect(getRes.statusCode).toBe(404);
  });

  it("list with limit and offset", async () => {
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: "POST",
        url: "/db/collections/paged",
        headers: authHeaders(),
        payload: { data: { index: i } },
      });
    }

    const page1 = await app.inject({
      method: "GET",
      url: "/db/collections/paged?limit=2&offset=0",
      headers: authHeaders(),
    });
    expect(page1.json().data.items).toHaveLength(2);
    expect(page1.json().data.total).toBe(5);

    const page2 = await app.inject({
      method: "GET",
      url: "/db/collections/paged?limit=2&offset=2",
      headers: authHeaders(),
    });
    expect(page2.json().data.items).toHaveLength(2);
  });

  it("list with filter (equality)", async () => {
    await app.inject({
      method: "POST",
      url: "/db/collections/filtered",
      headers: authHeaders(),
      payload: { data: { status: "active", name: "A" } },
    });
    await app.inject({
      method: "POST",
      url: "/db/collections/filtered",
      headers: authHeaders(),
      payload: { data: { status: "inactive", name: "B" } },
    });
    await app.inject({
      method: "POST",
      url: "/db/collections/filtered",
      headers: authHeaders(),
      payload: { data: { status: "active", name: "C" } },
    });

    const res = await app.inject({
      method: "GET",
      url: "/db/collections/filtered?filter=" + encodeURIComponent(JSON.stringify({ status: "active" })),
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.items).toHaveLength(2);
    expect(res.json().data.total).toBe(2);
  });

  it("list with filter (boolean)", async () => {
    await app.inject({
      method: "POST",
      url: "/db/collections/tasks",
      headers: authHeaders(),
      payload: { data: { done: false, title: "Open" } },
    });
    await app.inject({
      method: "POST",
      url: "/db/collections/tasks",
      headers: authHeaders(),
      payload: { data: { done: true, title: "Closed" } },
    });
    await app.inject({
      method: "POST",
      url: "/db/collections/tasks",
      headers: authHeaders(),
      payload: { data: { done: false, title: "Another" } },
    });

    const res = await app.inject({
      method: "GET",
      url: "/db/collections/tasks?filter=" + encodeURIComponent(JSON.stringify({ done: false })),
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.items).toHaveLength(2);
    expect(res.json().data.total).toBe(2);
  });

  it("401 without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/db/collections/todos",
    });
    expect(res.statusCode).toBe(401);
  });

  it("400 invalid collection name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/db/collections/invalid-name!",
      headers: authHeaders(),
      payload: { data: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("400 missing data field", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/db/collections/valid",
      headers: authHeaders(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });
});
