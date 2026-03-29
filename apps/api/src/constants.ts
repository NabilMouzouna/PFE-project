/**
 * App-wide constants (auth TTLs, paths, middleware rules).
 * Keep JWT string duration and ACCESS_TOKEN_EXPIRY_SECONDS in sync.
 */

/** Access JWT lifetime in seconds — must match API `expiresIn` responses. */
export const ACCESS_TOKEN_EXPIRY_SECONDS = 900;

/** better-auth JWT plugin `expirationTime` — must match ACCESS_TOKEN_EXPIRY_SECONDS (15m). */
export const ACCESS_TOKEN_EXPIRY_STRING = "15m" as const;

/** @better-auth/api-key default key prefix. */
export const API_KEY_PREFIX = "hs_live_" as const;

/** HttpOnly session cookie (better-auth session token) for browser refresh/logout. */
export const SESSION_COOKIE_NAME = "appbase_session" as const;

/** Max-Age for session cookie — align with better-auth session duration (7d). */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** better-auth internal routes relative to `BASE_URL`. */
export const AUTH_INTERNAL_PATHS = {
  token: "/api/auth/token",
  signOut: "/api/auth/sign-out",
  jwks: "/api/auth/jwks",
  /** Prefix for proxying all better-auth internals. */
  apiPrefix: "/api/auth/",
} as const;

/** Fastify route pattern that forwards to `auth.handler`. */
export const BETTER_AUTH_HANDLER_MOUNT = "/api/auth/*" as const;

/** Skipped by API key middleware: exact health check. */
export const HEALTH_PATH = "/health";

/** Skipped by API key middleware: OpenAPI / Swagger UI. */
export const DOCS_PATH_PREFIX = "/docs";

/** Skipped by API key middleware: first-operator bootstrap (guarded by bootstrap secret + DB check). */
export const BOOTSTRAP_FIRST_OPERATOR_PATH = "/bootstrap/first-operator";

/**
 * In `NODE_ENV=test`, these POST paths skip `x-api-key` so auth integration tests run without a key.
 */
export const TEST_EXCLUDED_AUTH_POST_PATHS: readonly string[] = [
  "/auth/register",
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
];

/** In test: /db/* and /storage/* skip x-api-key so integration tests run with JWT only. */
export const TEST_EXCLUDED_API_KEY_PATHS: readonly string[] = ["/db/", "/storage/"];


/** URL path prefixes that require a verified JWT access token. */
export const JWT_PROTECTED_PATH_PREFIXES: readonly string[] = ["/storage/", "/db/"];

/** Stable API error codes for auth middleware responses. */
export const API_ERROR_CODES = {
  INVALID_API_KEY: "INVALID_API_KEY",
  INVALID_TOKEN: "INVALID_TOKEN",
} as const;

/** User-facing messages for auth middleware (aligned with API contract). */
export const API_ERROR_MESSAGES = {
  INVALID_API_KEY_MISSING: "Missing or invalid API key.",
  INVALID_API_KEY: "Invalid API key.",
  INVALID_TOKEN: "The provided token is invalid or expired.",
} as const;
