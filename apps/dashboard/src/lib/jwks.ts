import { createRemoteJWKSet } from "jose";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function getApiBaseUrl(): string {
  const raw = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").trim();
  return raw.replace(/\/$/, "");
}

export function getJwksForBaseUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");
  let jwks = jwksCache.get(normalized);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${normalized}/api/auth/jwks`));
    jwksCache.set(normalized, jwks);
  }
  return jwks;
}
