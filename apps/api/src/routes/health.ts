import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ensureStorageRootReady } from "../utils/filesystem";

type CheckResult = { status: "up" } | { status: "down"; message: string };

const healthChecksSchema = {
  type: "object",
  properties: {
    database: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["up", "down"] },
        message: { type: "string" },
      },
      required: ["status"],
    },
    storage: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["up", "down"] },
        message: { type: "string" },
      },
      required: ["status"],
    },
  },
  required: ["database", "storage"],
} as const;

const healthRouteSchema = {
  tags: ["system"],
  summary: "Health check",
  description:
    "Verifies the API process, SQLite database, and storage root are usable. Recreates the storage directory and `objects/` if they were removed. Returns 503 if any dependency check fails.",
  response: {
    200: {
      type: "object",
      properties: {
        status: { type: "string", const: "healthy" },
        checks: healthChecksSchema,
      },
      required: ["status", "checks"],
    },
    503: {
      type: "object",
      properties: {
        status: { type: "string", const: "unhealthy" },
        checks: healthChecksSchema,
      },
      required: ["status", "checks"],
    },
  },
} as const;

function checkDatabase(app: FastifyInstance): CheckResult {
  try {
    app.db.run(sql`SELECT 1`);
    return { status: "up" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "down", message };
  }
}

function checkStorage(app: FastifyInstance): CheckResult {
  const root = app.config.storageRoot;
  try {
    ensureStorageRootReady(root);
    return { status: "up" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "down", message };
  }
}

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: healthRouteSchema,
    },
    async (request, reply) => {
      const database = checkDatabase(app);
      const storage = checkStorage(app);
      const checks = { database, storage };
      const healthy = database.status === "up" && storage.status === "up";

      if (!healthy) {
        request.log.warn({ checks }, "health.check.failed");
        return reply.status(503).send({ status: "unhealthy", checks });
      }

      return { status: "healthy", checks };
    },
  );
}
