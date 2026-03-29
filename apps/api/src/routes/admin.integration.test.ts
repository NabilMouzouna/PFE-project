import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app";
import { loadEnv } from "../config/env";
import * as schema from "@appbase/db/schema";
import { API_KEY_INSTANCE_USER_ID } from "../constants/bootstrap-user";

describe.sequential("admin routes", () => {
  const port = 38400 + (Math.floor(Math.random() * 800) % 800);
  const baseUrl = `http://127.0.0.1:${port}`;

  const testEnv = loadEnv({
    ...process.env,
    NODE_ENV: "test",
    DB_PATH: ":memory:",
    AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
    BASE_URL: baseUrl,
  });

  let app: Awaited<ReturnType<typeof buildApp>>;
  let apiKey: string;

  beforeAll(async () => {
    app = await buildApp({ env: testEnv });
    await app.listen({ port, host: "127.0.0.1" });

    const now = new Date();
    const users = await app.db.select().from(schema.user);
    if (!users.some((u) => u.id === API_KEY_INSTANCE_USER_ID)) {
      await app.db.insert(schema.user).values({
        id: API_KEY_INSTANCE_USER_ID,
        name: "App Bootstrap",
        email: "bootstrap@appbase.local",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    const created = (await app.auth.api.createApiKey({
      body: {
        name: "admin-test-key",
        userId: API_KEY_INSTANCE_USER_ID,
      },
    })) as { key?: string };
    if (!created.key) throw new Error("createApiKey did not return key");
    apiKey = created.key;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without x-api-key", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/users" });
    expect(res.statusCode).toBe(401);
  });

  it("lists users with valid api key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: { "x-api-key": apiKey },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; data: { users: { id: string }[] } };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.users)).toBe(true);
    expect(body.data.users.some((u) => u.id === API_KEY_INSTANCE_USER_ID)).toBe(false);
  });

  it("returns storage usage", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/storage/usage",
      headers: { "x-api-key": apiKey },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: { totalFiles: number; totalBytes: number; byBucket: unknown[] };
    };
    expect(body.success).toBe(true);
    expect(typeof body.data.totalFiles).toBe("number");
    expect(typeof body.data.totalBytes).toBe("number");
    expect(Array.isArray(body.data.byBucket)).toBe(true);
  });

  it("paginates audit log", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/audit-log?limit=10&offset=0",
      headers: { "x-api-key": apiKey },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: { items: unknown[]; total: number; limit: number; offset: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.limit).toBe(10);
    expect(body.data.offset).toBe(0);
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it("returns api-key metadata", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/api-key",
      headers: { "x-api-key": apiKey },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: { keyPrefix: string; masked: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.masked).toContain("••••");
  });

  it("returns 401 for setup-status without bearer", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/api-key/setup-status" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for GET /admin/api-key without x-api-key or bearer", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/api-key" });
    expect(res.statusCode).toBe(401);
  });

  it("rotates api key and invalidates the old one", async () => {
    const rotate = await app.inject({
      method: "POST",
      url: "/admin/api-key/rotate",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {},
    });
    expect(rotate.statusCode).toBe(200);
    const rotated = JSON.parse(rotate.body) as { success: boolean; data: { key: string } };
    expect(rotated.success).toBe(true);
    expect(rotated.data.key).toMatch(/^hs_live_/);

    const oldFails = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: { "x-api-key": apiKey },
    });
    expect(oldFails.statusCode).toBe(401);

    const newWorks = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: { "x-api-key": rotated.data.key },
    });
    expect(newWorks.statusCode).toBe(200);

    apiKey = rotated.data.key;
  });

  it("sets user password for credential account", async () => {
    const email = `pw-admin-${Date.now()}@example.com`;
    const reg = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "OriginalPass123!" },
    });
    expect(reg.statusCode).toBe(201);
    const regBody = JSON.parse(reg.body) as { data: { user: { id: string } } };
    const userId = regBody.data.user.id;

    const setPw = await app.inject({
      method: "POST",
      url: `/admin/users/${userId}/password`,
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { newPassword: "ResetPass456!" },
    });
    expect(setPw.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "ResetPass456!" },
    });
    expect(login.statusCode).toBe(200);
  });
});
