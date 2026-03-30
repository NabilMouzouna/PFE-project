import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { user } from "@appbase/db/schema";
import { AUTH_INTERNAL_PATHS } from "../constants";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");
  let jwks = jwksCache.get(normalized);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${normalized}${AUTH_INTERNAL_PATHS.jwks}`));
    jwksCache.set(normalized, jwks);
  }
  return jwks;
}

export function getBearerToken(request: { headers: { authorization?: string } }): string | null {
  const authHeader = request.headers.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
}

export async function verifyAdminAccessToken(token: string, app: FastifyInstance): Promise<boolean> {
  try {
    const baseUrl = app.config.BASE_URL;
    const jwks = getJwks(baseUrl);
    const { payload } = await jwtVerify(token, jwks, { algorithms: ["EdDSA"] });
    if (payload.role !== "admin") return false;

    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return false;

    // DB-backed authorization: token claim must map to a current admin user row.
    const rows = await app.db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const row = rows[0];
    return Boolean(row && row.role === "admin");
  } catch {
    return false;
  }
}
