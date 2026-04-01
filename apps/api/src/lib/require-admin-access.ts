import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getBearerToken, verifyAdminAccessToken } from "./verify-admin-access-token";

function apiError(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

/**
 * Admin access is granted by either:
 * - valid `x-api-key` (instance key model), or
 * - valid admin bearer token from operator login.
 */
export async function requireAdminAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance,
): Promise<boolean> {
  const apiKeyHeader = request.headers["x-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader.length > 0) {
    try {
      const result = await app.auth.api.verifyApiKey({ body: { key: apiKeyHeader } });
      if (result.valid) return true;
    } catch {
      // fall through to bearer check
    }
  }

  const bearer = getBearerToken(request);
  if (bearer && (await verifyAdminAccessToken(bearer, app))) {
    return true;
  }

  await reply.status(401).send(apiError("UNAUTHORIZED", "Admin access requires x-api-key or admin bearer token."));
  return false;
}
