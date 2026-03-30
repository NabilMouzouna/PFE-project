import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { apiKeys } from "@appbase/db/schema";
import { API_KEY_INSTANCE_USER_ID } from "../constants/bootstrap-user";
import { getBearerToken, verifyAdminAccessToken } from "./verify-admin-access-token";

function apiError(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

export type InstanceKeyRow = typeof apiKeys.$inferSelect;

/**
 * Resolves access to the single instance API key row via `x-api-key` or admin JWT (operator console).
 */
export async function resolveInstanceApiKeyAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance,
): Promise<{ keyId: string; referenceId: string; row: InstanceKeyRow } | null> {
  const headerKey = request.headers["x-api-key"];
  if (typeof headerKey === "string" && headerKey.length > 0) {
    try {
      const result = await app.auth.api.verifyApiKey({
        body: { key: headerKey },
      });
      if (!result.valid || !result.key?.id) {
        await reply.status(401).send(apiError("INVALID_API_KEY", "Invalid API key."));
        return null;
      }
      const rows = await app.db.select().from(apiKeys).where(eq(apiKeys.id, result.key.id)).limit(1);
      const row = rows[0];
      if (!row || row.referenceId !== API_KEY_INSTANCE_USER_ID) {
        await reply
          .status(403)
          .send(apiError("FORBIDDEN", "This key is not the instance API key for this deployment."));
        return null;
      }
      return { keyId: row.id, referenceId: row.referenceId, row };
    } catch {
      await reply.status(401).send(apiError("INVALID_API_KEY", "Invalid API key."));
      return null;
    }
  }

  const bearer = getBearerToken(request);
  if (bearer && (await verifyAdminAccessToken(bearer, app))) {
    const rows = await app.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.referenceId, API_KEY_INSTANCE_USER_ID))
      .limit(1);
    const row = rows[0];
    if (!row) {
      await reply
        .status(404)
        .send(apiError("NOT_FOUND", "No instance API key yet. Generate one from the operator console."));
      return null;
    }
    return { keyId: row.id, referenceId: row.referenceId, row };
  }

  await reply
    .status(401)
    .send(
      apiError(
        "UNAUTHORIZED",
        "Provide x-api-key or Authorization: Bearer <admin access token> (operator session).",
      ),
    );
  return null;
}
