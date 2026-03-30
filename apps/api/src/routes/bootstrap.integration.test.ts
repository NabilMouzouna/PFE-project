import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app";
import { loadEnv } from "../config/env";

describe.sequential("bootstrap first operator", () => {
  const port = 38600 + (Math.floor(Math.random() * 400) % 400);
  const baseUrl = `http://127.0.0.1:${port}`;

  const testEnv = loadEnv({
    ...process.env,
    NODE_ENV: "test",
    DB_PATH: ":memory:",
    AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
    BASE_URL: baseUrl,
  });

  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ env: testEnv });
    await app.listen({ port, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates first admin without bootstrap header in test", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/bootstrap/first-operator",
      payload: { email: "op1@example.com", password: "password12345" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { success: boolean; data: { user: { role: string | null } } };
    expect(body.success).toBe(true);
    expect(body.data.user.role).toBe("admin");
  });

  it("rejects second bootstrap", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/bootstrap/first-operator",
      payload: { email: "op2@example.com", password: "password12345" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("requires bootstrap secret in production when configured", async () => {
    const prodPort = port + 1;
    const prodBase = `http://127.0.0.1:${prodPort}`;
    const prodEnv = loadEnv({
      ...process.env,
      NODE_ENV: "production",
      DB_PATH: ":memory:",
      AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long-for-prod",
      BASE_URL: prodBase,
      APPBASE_BOOTSTRAP_SECRET: "bootstrap-secret-for-test-only-min-8",
      STORAGE_ROOT: path.join(os.tmpdir(), `appbase-bootstrap-prod-${randomUUID()}`),
    });
    const prodApp = await buildApp({ env: prodEnv });
    await prodApp.listen({ port: prodPort, host: "127.0.0.1" });

    const noHeader = await prodApp.inject({
      method: "POST",
      url: "/bootstrap/first-operator",
      payload: { email: "prodop@example.com", password: "password12345" },
    });
    expect(noHeader.statusCode).toBe(401);

    const ok = await prodApp.inject({
      method: "POST",
      url: "/bootstrap/first-operator",
      headers: { "x-appbase-bootstrap-secret": "bootstrap-secret-for-test-only-min-8" },
      payload: { email: "prodop@example.com", password: "password12345" },
    });
    expect(ok.statusCode).toBe(201);

    await prodApp.close();
  });
});
