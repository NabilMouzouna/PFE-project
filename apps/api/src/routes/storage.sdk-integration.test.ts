/**
 * Integration tests: SDK storage client against live API (API-SPEC §6).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { AppBase } from "@appbase/sdk";
import { buildApp } from "../app";
import { loadEnv } from "../config/env";

describe("SDK storage integration", () => {
  const port = 38600 + (Math.floor(Math.random() * 500) % 500);
  const baseUrl = `http://127.0.0.1:${port}`;

  let tmpDir: string;
  let testEnv: ReturnType<typeof loadEnv>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let appbase: AppBase;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appbase-sdk-stor-"));
    testEnv = loadEnv({
      ...process.env,
      NODE_ENV: "test",
      DB_PATH: path.join(tmpDir, "app.sqlite"),
      STORAGE_ROOT: path.join(tmpDir, "storage"),
      AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
      BASE_URL: baseUrl,
      STORAGE_ALLOWED_MIME: "*",
    });
    app = await buildApp({ env: testEnv });
    await app.listen({ port, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const email = `sdk-st-${Date.now()}@example.com`;
    const password = "SecurePassword123!";

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password },
    });

    appbase = AppBase.init({
      endpoint: baseUrl,
      apiKey: "hs_live_test_key",
    });

    await appbase.auth.signIn({ email, password });
  });

  it("upload, list, download, remove happy path", async () => {
    const up = await appbase.storage.upload(
      "docs",
      new Blob(["hello-sdk"], { type: "text/plain" }),
      { filename: "note.txt" },
    );

    expect(up.file.id).toBeDefined();
    expect(up.file.bucket).toBe("docs");
    expect(up.url).toContain(up.file.id);

    const listed = await appbase.storage.list("docs");
    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.files.some((f) => f.id === up.file.id)).toBe(true);

    const buf = await appbase.storage.download("docs", up.file.id, { as: "buffer" });
    expect(buf.toString()).toBe("hello-sdk");

    await appbase.storage.remove("docs", up.file.id);

    const listed2 = await appbase.storage.list("docs");
    expect(listed2.files.every((f) => f.id !== up.file.id)).toBe(true);
  });

  it("SDK validates bucket before request", async () => {
    await expect(appbase.storage.upload("bad/name", new Blob(["x"]))).rejects.toMatchObject({
      name: "StorageError",
      code: "VALIDATION_ERROR",
    });
  });

  it("throws when session cleared before storage call", async () => {
    await appbase.auth.signOut();
    await expect(appbase.storage.list("docs")).rejects.toThrow(/Not authenticated|signIn/i);
  });

  it("ownership: other user gets NOT_FOUND on download", async () => {
    const up = await appbase.storage.upload("private", new Blob(["secret"]), { filename: "a.bin" });

    const email2 = `sdk-st-2-${Date.now()}@example.com`;
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: email2, password: "SecurePassword123!" },
    });

    const other = AppBase.init({ endpoint: baseUrl, apiKey: "hs_live_test_key" });
    await other.auth.signIn({ email: email2, password: "SecurePassword123!" });

    await expect(other.storage.download("private", up.file.id, { as: "buffer" })).rejects.toMatchObject({
      name: "StorageError",
      code: "NOT_FOUND",
    });
  });

  it("disallowed MIME propagated", async () => {
    const mimePort = port + 6000;
    const mimeBase = `http://127.0.0.1:${mimePort}`;
    const envMime = loadEnv({
      ...process.env,
      NODE_ENV: "test",
      DB_PATH: path.join(tmpDir, `mime-${Date.now()}.sqlite`),
      STORAGE_ROOT: path.join(tmpDir, `mime-st-${Date.now()}`),
      AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
      BASE_URL: mimeBase,
      STORAGE_ALLOWED_MIME: "image/png",
    });
    const appMime = await buildApp({ env: envMime });
    await appMime.listen({ port: mimePort, host: "127.0.0.1" });

    const email = `sdk-st-mime-${Date.now()}@example.com`;
    await appMime.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "SecurePassword123!" },
    });

    const client = AppBase.init({ endpoint: mimeBase, apiKey: "hs_live_test_key" });
    await client.auth.signIn({ email, password: "SecurePassword123!" });

    await expect(
      client.storage.upload("b", new Blob(["x"], { type: "text/plain" }), { filename: "x.txt" }),
    ).rejects.toMatchObject({
      name: "StorageError",
      code: "VALIDATION_ERROR",
    });

    await appMime.close();
  });
});
