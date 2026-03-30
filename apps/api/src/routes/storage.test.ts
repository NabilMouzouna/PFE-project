import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app";
import { loadEnv } from "../config/env";
import { reconcileFileStorage } from "../storage/reconcile";

const TEST_PASSWORD = "SecurePassword123!";

function multipartUpload(filename: string, content: string, mime = "text/plain"): {
  payload: string;
  headers: Record<string, string>;
} {
  const boundary = "----AppBaseStorageTest";
  const payload =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--\r\n`;
  return {
    payload,
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  };
}

async function createTestUser(app: Awaited<ReturnType<typeof buildApp>>): Promise<{
  accessToken: string;
  userId: string;
  email: string;
}> {
  const email = `st-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const registerRes = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: TEST_PASSWORD },
  });
  expect(registerRes.statusCode).toBe(201);
  const { data } = registerRes.json() as { data: { accessToken: string; user: { id: string } } };
  return { accessToken: data.accessToken, userId: data.user.id, email };
}

describe("storage routes", () => {
  const port = 39572 + (Math.floor(Math.random() * 500) % 500);
  const baseUrl = `http://127.0.0.1:${port}`;

  let tmpDir: string;
  let dbPath: string;
  let storageRoot: string;
  let testEnv: ReturnType<typeof loadEnv>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let accessToken: string;
  let userEmail: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appbase-api-storage-"));
    dbPath = path.join(tmpDir, "app.sqlite");
    storageRoot = path.join(tmpDir, "storage");
    testEnv = loadEnv({
      ...process.env,
      NODE_ENV: "test",
      DB_PATH: dbPath,
      STORAGE_ROOT: storageRoot,
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
    const u = await createTestUser(app);
    accessToken = u.accessToken;
    userEmail = u.email;
  });

  const authHeaders = (extra?: Record<string, string>) => ({
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  });

  it("POST upload → GET list → GET download → DELETE roundtrip", async () => {
    const mp = multipartUpload("hello.txt", "roundtrip-body", "text/plain");
    const up = await app.inject({
      method: "POST",
      url: "/storage/buckets/docs/upload",
      headers: { ...authHeaders(), ...mp.headers },
      payload: mp.payload,
    });
    expect(up.statusCode).toBe(201);
    const upJson = up.json() as { data: { file: { id: string }; url: string } };
    const fileId = upJson.data.file.id;
    expect(upJson.data.url).toBe(`/storage/buckets/docs/${fileId}`);

    const list = await app.inject({
      method: "GET",
      url: "/storage/buckets/docs",
      headers: authHeaders(),
    });
    expect(list.statusCode).toBe(200);
    const listJson = list.json() as { data: { files: { id: string }[]; total: number } };
    expect(listJson.data.total).toBe(1);
    expect(listJson.data.files[0]!.id).toBe(fileId);

    const dl = await app.inject({
      method: "GET",
      url: `/storage/buckets/docs/${fileId}`,
      headers: authHeaders(),
    });
    expect(dl.statusCode).toBe(200);
    expect(dl.body).toBe("roundtrip-body");
    expect(dl.headers["content-type"]).toContain("text/plain");

    const del = await app.inject({
      method: "DELETE",
      url: `/storage/buckets/docs/${fileId}`,
      headers: authHeaders(),
    });
    expect(del.statusCode).toBe(200);

    const list2 = await app.inject({
      method: "GET",
      url: "/storage/buckets/docs",
      headers: authHeaders(),
    });
    expect((list2.json() as { data: { total: number } }).data.total).toBe(0);
  });

  it("isolates ownership: other user cannot download", async () => {
    const mp = multipartUpload("secret.txt", "x", "text/plain");
    const up = await app.inject({
      method: "POST",
      url: "/storage/buckets/private/upload",
      headers: { ...authHeaders(), ...mp.headers },
      payload: mp.payload,
    });
    expect(up.statusCode).toBe(201);
    const fileId = (up.json() as { data: { file: { id: string } } }).data.file.id;

    const other = await createTestUser(app);
    const probe = await app.inject({
      method: "GET",
      url: `/storage/buckets/private/${fileId}`,
      headers: { Authorization: `Bearer ${other.accessToken}` },
    });
    expect(probe.statusCode).toBe(404);
  });

  it("rejects invalid bucket names", async () => {
    const mp = multipartUpload("a.txt", "x");
    const res = await app.inject({
      method: "POST",
      url: "/storage/buckets/not%20valid!/upload",
      headers: { ...authHeaders(), ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects disallowed MIME when policy is set", async () => {
    const narrowPort = port + 10_000;
    const narrowBase = `http://127.0.0.1:${narrowPort}`;
    const narrowEnv = loadEnv({
      ...process.env,
      NODE_ENV: "test",
      DB_PATH: path.join(tmpDir, `narrow-${Date.now()}.sqlite`),
      STORAGE_ROOT: path.join(tmpDir, `narrow-storage-${Date.now()}`),
      AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
      BASE_URL: narrowBase,
      STORAGE_ALLOWED_MIME: "image/png",
    });
    const app2 = await buildApp({ env: narrowEnv });
    await app2.listen({ port: narrowPort, host: "127.0.0.1" });
    const u = await createTestUser(app2);
    const mp = multipartUpload("x.txt", "hi", "text/plain");
    const res = await app2.inject({
      method: "POST",
      url: "/storage/buckets/b/upload",
      headers: { Authorization: `Bearer ${u.accessToken}`, ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(400);
    await app2.close();
  });

  it("returns 404 when object bytes are missing on disk", async () => {
    const mp = multipartUpload("gone.bin", "data", "application/octet-stream");
    const up = await app.inject({
      method: "POST",
      url: "/storage/buckets/b/upload",
      headers: { ...authHeaders(), ...mp.headers },
      payload: mp.payload,
    });
    expect(up.statusCode).toBe(201);
    const fileId = (up.json() as { data: { file: { id: string } } }).data.file.id;

    const objectPath = path.join(storageRoot, "objects", fileId);
    expect(fs.existsSync(objectPath)).toBe(true);
    fs.unlinkSync(objectPath);

    const dl = await app.inject({
      method: "GET",
      url: `/storage/buckets/b/${fileId}`,
      headers: authHeaders(),
    });
    expect(dl.statusCode).toBe(404);
  });

  it("survives process restart with same DB and storage paths (login + download)", async () => {
    const mp = multipartUpload("persist.txt", " durable ", "text/plain");
    const up = await app.inject({
      method: "POST",
      url: "/storage/buckets/keep/upload",
      headers: { ...authHeaders(), ...mp.headers },
      payload: mp.payload,
    });
    expect(up.statusCode).toBe(201);
    const fileId = (up.json() as { data: { file: { id: string } } }).data.file.id;

    await app.close();

    const app2 = await buildApp({ env: testEnv });
    await app2.listen({ port, host: "127.0.0.1" });
    const login = await app2.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: userEmail, password: TEST_PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const token2 = (login.json() as { data: { accessToken: string } }).data.accessToken;

    const dl = await app2.inject({
      method: "GET",
      url: `/storage/buckets/keep/${fileId}`,
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(dl.statusCode).toBe(200);
    expect(dl.body).toBe(" durable ");

    await app2.close();
    app = await buildApp({ env: testEnv });
    await app.listen({ port, host: "127.0.0.1" });
  });
});

describe("storage reconciliation (integration)", () => {
  it("reconcile sees uploaded file in metadata and on disk", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "appbase-st-recon-"));
    const dbFile = path.join(tmp, "r.sqlite");
    const sRoot = path.join(tmp, "s");
    const env = loadEnv({
      ...process.env,
      NODE_ENV: "test",
      DB_PATH: dbFile,
      STORAGE_ROOT: sRoot,
      AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
      BASE_URL: "http://127.0.0.1:9",
      STORAGE_ALLOWED_MIME: "*",
    });
    const application = await buildApp({ env });
    const u = await createTestUser(application);
    const mp = multipartUpload("x.bin", "y");
    await application.inject({
      method: "POST",
      url: "/storage/buckets/z/upload",
      headers: { Authorization: `Bearer ${u.accessToken}`, ...mp.headers },
      payload: mp.payload,
    });
    const r = await reconcileFileStorage(application.db, application.storageDriver);
    expect(r.metadataMissingObject).toEqual([]);
    expect(r.objectWithoutMetadata).toEqual([]);
    await application.close();
  });
});
