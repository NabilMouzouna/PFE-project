import { describe, expect, it, beforeEach } from "vitest";

import { buildApp } from "../app";
import { loadEnv } from "../config/env";

function sessionCookiePair(registerRes: { headers: Record<string, unknown> }): string {
  const setCookieHeader = registerRes.headers["set-cookie"];
  expect(setCookieHeader).toBeDefined();
  const parts = (Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]).map(String);
  const sessionLine = parts.find((p) => typeof p === "string" && p.startsWith("appbase_session="));
  expect(sessionLine).toBeDefined();
  return sessionLine!.split(";")[0]!;
}

describe("auth routes", () => {
  const testEnv = loadEnv({
    ...process.env,
    NODE_ENV: "test",
    DB_PATH: ":memory:",
    AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
    BASE_URL: "http://localhost:3000",
  });

  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp({ env: testEnv });
  });

  it("POST /auth/register - success", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com", password: "SecurePassword123!" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: 900,
      user: {
        id: expect.any(String),
        email: "test@example.com",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("POST /auth/register - returns customIdentity when provided", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "custom-id@example.com",
        password: "SecurePassword123!",
        customIdentity: { displayName: "Test", company: "Acme" },
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.user.customIdentity).toEqual({
      displayName: "Test",
      company: "Acme",
    });
  });

  it("POST /auth/register - conflict (duplicate email)", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "dup@example.com", password: "SecurePassword123!" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "dup@example.com", password: "OtherSecure456!" },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("already exists");
  });

  it("POST /auth/register - validation error (missing email)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { password: "password123" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /auth/register - validation error (missing password)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com" } as object,
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /auth/login - success", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "login@example.com", password: "SecurePassword123!" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "login@example.com", password: "SecurePassword123!" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: 900,
      user: { email: "login@example.com" },
    });
  });

  it("POST /auth/login - invalid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nonexistent@example.com", password: "wrong" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("POST /auth/refresh - success with session cookie", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "refresh@example.com", password: "SecurePassword123!" },
    });
    const cookiePair = sessionCookiePair(registerRes);

    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: cookiePair },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: 900,
    });
  });

  it("POST /auth/refresh - 401 when session cookie missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /auth/refresh - 401 when Authorization Bearer present but no cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { Authorization: "Bearer some-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /auth/refresh - 401 for invalid session cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: "appbase_session=not-a-valid-session" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /auth/logout - success with session cookie and clears cookie", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "logout@example.com", password: "SecurePassword123!" },
    });
    const cookiePair = sessionCookiePair(registerRes);

    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: cookiePair },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.loggedOut).toBe(true);

    const cleared = res.headers["set-cookie"];
    expect(cleared).toBeDefined();
    const clearedJoined = Array.isArray(cleared) ? cleared.join("\n") : String(cleared);
    expect(clearedJoined.toLowerCase()).toContain("appbase_session=");
    expect(clearedJoined.toLowerCase()).toMatch(/max-age=0|expires=/);
  });

  it("POST /auth/logout - idempotent when no session cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.loggedOut).toBe(true);
  });
});
