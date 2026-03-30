import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app";
import { loadEnv } from "../config/env";
import { registerHealthRoutes } from "./health";

describe("health route module", () => {
  it("exports registerHealthRoutes", () => {
    expect(typeof registerHealthRoutes).toBe("function");
  });
});

describe("GET /health", () => {
  const port = 39620 + (Math.floor(Math.random() * 500) % 500);
  const baseUrl = `http://127.0.0.1:${port}`;

  let tmpDir: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appbase-api-health-"));
    const dbPath = path.join(tmpDir, "app.sqlite");
    const storageRoot = path.join(tmpDir, "storage");
    const testEnv = loadEnv({
      ...process.env,
      NODE_ENV: "test",
      DB_PATH: dbPath,
      STORAGE_ROOT: storageRoot,
      AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
      BASE_URL: baseUrl,
    });
    app = await buildApp({ env: testEnv });
    await app.listen({ port, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with healthy checks when DB and storage are usable", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      status: string;
      checks: { database: { status: string }; storage: { status: string } };
    };
    expect(body.status).toBe("healthy");
    expect(body.checks.database.status).toBe("up");
    expect(body.checks.storage.status).toBe("up");
  });

  it("recreates storage root when the folder was removed", async () => {
    const storageRoot = app.config.storageRoot;
    fs.rmSync(storageRoot, { recursive: true, force: true });
    expect(fs.existsSync(storageRoot)).toBe(false);

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(fs.existsSync(storageRoot)).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "objects"))).toBe(true);
  });

  it("returns 503 when storage root becomes unreadable (simulated dependency failure)", async () => {
    const storageRoot = app.config.storageRoot;
    const prev = fs.statSync(storageRoot).mode;
    try {
      fs.chmodSync(storageRoot, 0o000);
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(503);
      const body = res.json() as {
        status: string;
        checks: { database: { status: string }; storage: { status: string; message?: string } };
      };
      expect(body.status).toBe("unhealthy");
      expect(body.checks.database.status).toBe("up");
      expect(body.checks.storage.status).toBe("down");
    } finally {
      fs.chmodSync(storageRoot, prev);
    }
  });
});
