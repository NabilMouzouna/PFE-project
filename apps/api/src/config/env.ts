import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { z } from "zod";

/** `apps/api` — stable base for `data/storage` (avoids `process.cwd()` when turbo/root runs dev). */
const API_PACKAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(8000),
  /** Relative paths resolved against `apps/api` (same as `STORAGE_ROOT`). */
  DB_PATH: z.string().min(1).default("data/appbase.sqlite"),
  /** Absolute or relative to `apps/api`; default production `/app/data/storage`, else `apps/api/data/storage`. */
  STORAGE_ROOT: z.string().optional(),
  /** Max upload size in bytes (multipart / storage enforcement). Default 50 MiB. */
  STORAGE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().optional(),
  /**
   * Comma-separated MIME types and `type/*` patterns. Empty or `*` = allow all (dev-friendly).
   * Example: `image/*,application/pdf,text/plain`
   */
  STORAGE_ALLOWED_MIME: z.string().optional(),
  /** `fs` only in M1; reserved for future `s3` driver. */
  STORAGE_DRIVER: z.enum(["fs"]).default("fs"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  BASE_URL: z.string().url().optional(),
  /** Comma-separated allowed origins (e.g. `http://localhost:3001`). Use `*` to allow any origin. */
  CORS_ORIGINS: z.string().optional(),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters")
    .optional(),
  /** When set, dev requires matching `x-appbase-bootstrap-secret`; production requires it for bootstrap. */
  APPBASE_BOOTSTRAP_SECRET: z.string().optional(),
});

type ParsedEnv = z.output<typeof envSchema>;

export type StorageEnv = {
  storageRoot: string;
  storageMaxUploadBytes: number;
  storageAllowedMime: string | null;
  storageDriver: "fs";
};

export type AppEnv = Omit<
  ParsedEnv,
  | "BASE_URL"
  | "AUTH_SECRET"
  | "CORS_ORIGINS"
  | "STORAGE_ROOT"
  | "STORAGE_MAX_UPLOAD_BYTES"
  | "STORAGE_ALLOWED_MIME"
  | "APPBASE_BOOTSTRAP_SECRET"
> & {
  BASE_URL: string;
  AUTH_SECRET: string;
  /** Null when unset — dev allows bootstrap without header; prod requires secret + header. */
  bootstrapSecret: string | null;
  corsAllowedOrigins: string[];
  /**
   * `NODE_ENV=development` + `DEV_SKIP_API_KEY=true`: same x-api-key bypass as Vitest (auth POST paths,
   * `/api/auth/*`, `/db/`, `/storage/`). Never use in production.
   */
  devSkipApiKey: boolean;
} & StorageEnv;

function envFlagTrue(value: string | undefined): boolean {
  if (value == null || value === "") return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function buildCorsAllowedOrigins(corsOriginsEnv: string | undefined, baseUrl: string): string[] {
  const fromEnv =
    corsOriginsEnv
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  let baseOrigin: string;
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    baseOrigin = "http://localhost:3000";
  }
  const defaults = [
    baseOrigin,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5180",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5180",
    "http://[::1]:3000",
    "http://[::1]:3001",
    "http://[::1]:5180",
  ];
  return [...new Set([...fromEnv, ...defaults])];
}

export function loadEnv(source: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.parse(source);
  const publicHost = parsed.HOST === "0.0.0.0" ? "localhost" : parsed.HOST;

  const authSecret = parsed.AUTH_SECRET;
  if (parsed.NODE_ENV === "production" && (!authSecret || authSecret.length < 32)) {
    throw new Error(
      "AUTH_SECRET is required in production and must be at least 32 characters",
    );
  }

  const baseUrl = parsed.BASE_URL ?? `http://${publicHost}:${parsed.PORT}`;
  const {
    CORS_ORIGINS,
    STORAGE_ROOT,
    STORAGE_MAX_UPLOAD_BYTES,
    STORAGE_ALLOWED_MIME,
    APPBASE_BOOTSTRAP_SECRET,
    DB_PATH: dbPathRaw,
    ...rest
  } = parsed;

  const dbPath =
    dbPathRaw === ":memory:" || dbPathRaw.startsWith("file:")
      ? dbPathRaw
      : path.isAbsolute(dbPathRaw)
        ? dbPathRaw
        : path.resolve(API_PACKAGE_ROOT, dbPathRaw);

  /**
   * Isolated tmp dirs only under Vitest (`VITEST=true`). Using `NODE_ENV=test` for a dev server
   * would otherwise put bytes in /tmp and leave `apps/api/data/storage` empty.
   */
  const storageRoot =
    STORAGE_ROOT && STORAGE_ROOT.length > 0
      ? path.isAbsolute(STORAGE_ROOT)
        ? STORAGE_ROOT
        : path.resolve(API_PACKAGE_ROOT, STORAGE_ROOT)
      : parsed.NODE_ENV === "production"
        ? "/app/data/storage"
        : process.env.VITEST === "true"
          ? path.join(os.tmpdir(), `appbase-api-storage-${randomUUID()}`)
          : path.join(API_PACKAGE_ROOT, "data/storage");

  const storageMaxUploadBytes = STORAGE_MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024;
  const storageAllowedMime =
    STORAGE_ALLOWED_MIME == null || STORAGE_ALLOWED_MIME.trim() === "" || STORAGE_ALLOWED_MIME.trim() === "*"
      ? null
      : STORAGE_ALLOWED_MIME.trim();

  const devSkipApiKeyRequested = envFlagTrue(source.DEV_SKIP_API_KEY);
  if (devSkipApiKeyRequested && parsed.NODE_ENV !== "development") {
    throw new Error("DEV_SKIP_API_KEY may only be set when NODE_ENV=development");
  }
  const devSkipApiKey = parsed.NODE_ENV === "development" && devSkipApiKeyRequested;

  const bootstrapSecret =
    APPBASE_BOOTSTRAP_SECRET != null && APPBASE_BOOTSTRAP_SECRET.trim().length > 0
      ? APPBASE_BOOTSTRAP_SECRET.trim()
      : null;

  return {
    ...rest,
    DB_PATH: dbPath,
    BASE_URL: baseUrl,
    AUTH_SECRET: authSecret ?? "dev-secret-min-32-chars-required-for-auth",
    bootstrapSecret,
    corsAllowedOrigins: buildCorsAllowedOrigins(CORS_ORIGINS, baseUrl),
    storageRoot,
    storageMaxUploadBytes,
    storageAllowedMime,
    storageDriver: parsed.STORAGE_DRIVER,
    devSkipApiKey,
  };
}
