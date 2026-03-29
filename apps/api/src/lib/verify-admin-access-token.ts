import type { FastifyInstance } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
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
    return payload.role === "admin";
  } catch {
    return false;
  }
}
