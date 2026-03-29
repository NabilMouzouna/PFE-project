import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { apiKeys, user } from "@appbase/db/schema";
import { API_KEY_INSTANCE_USER_ID } from "../constants/bootstrap-user";

/**
 * M1: ensure exactly one instance-scoped API key exists after DB + auth are ready.
 * Skipped in tests. Logs the full key once so operators can set DASHBOARD_API_KEY without using the CLI script.
 */
export async function ensureInstanceApiKeyAtStartup(app: FastifyInstance): Promise<void> {
  if (app.config.NODE_ENV === "test") return;

  const existing = await app.db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.referenceId, API_KEY_INSTANCE_USER_ID))
    .limit(1);
  if (existing[0]) return;

  const u = await app.db.select({ id: user.id }).from(user).where(eq(user.id, API_KEY_INSTANCE_USER_ID)).limit(1);
  if (!u[0]) {
    const now = new Date();
    await app.db.insert(user).values({
      id: API_KEY_INSTANCE_USER_ID,
      name: "App Bootstrap",
      email: "bootstrap@appbase.local",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    const created = (await app.auth.api.createApiKey({
      body: {
        name: "instance",
        userId: API_KEY_INSTANCE_USER_ID,
      },
    })) as { key?: string };
    const key = created.key;
    if (key) {
      app.log.warn(
        { event: "instance_api_key_auto_created" },
        `Instance API key created at startup. Set apps/dashboard/.env DASHBOARD_API_KEY to this value (and use x-api-key in clients): ${key}`,
      );
    } else {
      app.log.error("instance_api_key_auto_create returned no key");
    }
  } catch (err) {
    app.log.error({ err }, "instance_api_key_auto_create_failed");
  }
}
