/**
 * Integration tests: SDK database client against live API.
 * Starts the API server, signs in via SDK, runs CRUD through appbase.db.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { z } from "zod";
import { AppBase } from "@appbase/sdk";
import { buildApp } from "../app";
import { loadEnv } from "../config/env";

const TodoSchema = z.object({
  title: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
});

type TodoData = z.infer<typeof TodoSchema>;


describe("SDK db integration", () => {
  const port = 38500 + (Math.floor(Math.random() * 1000) % 500);
  const baseUrl = `http://127.0.0.1:${port}`;

  const testEnv = loadEnv({
    ...process.env,
    NODE_ENV: "test",
    DB_PATH: ":memory:",
    AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
    BASE_URL: baseUrl,
  });

  let app: Awaited<ReturnType<typeof buildApp>>;
  let appbase: AppBase;

  beforeAll(async () => {
    app = await buildApp({ env: testEnv });
    await app.listen({ port, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const email = `sdk-db-${Date.now()}@example.com`;
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

  it("create, list, get, update, delete via SDK", async () => {
    const todos = appbase.db.collection("todos", TodoSchema as unknown as Parameters<AppBase["db"]["collection"]>[1]);

    const created = await todos.create({
      title: "SDK integration test",
      done: false,
      createdAt: new Date().toISOString(),
    });

    expect(created.id).toBeDefined();
    expect(created.data.title).toBe("SDK integration test");
    expect(created.data.done).toBe(false);
    expect(created.collection).toBe("todos");
    expect(created.ownerId).toBeDefined();

    const { items, total } = await todos.list();
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThanOrEqual(1);
    const found = items.find((i) => i.id === created.id);
    expect(found).toBeDefined();
    expect(found!.data.title).toBe("SDK integration test");

    const one = await todos.get(created.id);
    expect(one.id).toBe(created.id);
    expect(one.data.title).toBe("SDK integration test");

    const updated = await todos.update(created.id, { done: true });
    expect(updated.data.done).toBe(true);
    expect(updated.data.title).toBe("SDK integration test");

    await todos.delete(created.id);

    await expect(todos.get(created.id)).rejects.toMatchObject({
      name: "DbError",
      code: "NOT_FOUND",
    });
  });

  it("list with filter and pagination", async () => {
    const todos = appbase.db.collection("todos", TodoSchema as unknown as Parameters<AppBase["db"]["collection"]>[1]);

    await todos.create({
      title: "Open 1",
      done: false,
      createdAt: new Date().toISOString(),
    });
    await todos.create({
      title: "Open 2",
      done: false,
      createdAt: new Date().toISOString(),
    });
    await todos.create({
      title: "Done 1",
      done: true,
      createdAt: new Date().toISOString(),
    });

    const { items: openItems, total } = await todos.list({
      filter: { done: false },
      limit: 10,
      offset: 0,
    });

    expect(openItems.length).toBe(2);
    expect(total).toBe(2);
    expect(openItems.every((i) => !(i.data as TodoData).done)).toBe(true);
  });

  it("subscribe receives events after create", async () => {
    const todos = appbase.db.collection("todos", TodoSchema as unknown as Parameters<AppBase["db"]["collection"]>[1]);
    const events: { type: string; record?: { id: string } }[] = [];

    const unsub = todos.subscribe((e) => {
      events.push({ type: e.type, record: e.record as { id: string } });
    });

    await new Promise((r) => setTimeout(r, 100));

    const created = await todos.create({
      title: "Subscribe test",
      done: false,
      createdAt: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 150));
    unsub();

    expect(events.some((e) => e.type === "created" && e.record?.id === created.id)).toBe(true);
  });
});
