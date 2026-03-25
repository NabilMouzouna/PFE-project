import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().min(1).default("data/appbase.sqlite"),
  /** Absolute or relative path; default `/app/data/storage` in production, else `<cwd>/data/storage`. */
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
  "BASE_URL" | "AUTH_SECRET" | "CORS_ORIGINS" | "STORAGE_ROOT" | "STORAGE_MAX_UPLOAD_BYTES" | "STORAGE_ALLOWED_MIME"
> & {
  BASE_URL: string;
  AUTH_SECRET: string;
  corsAllowedOrigins: string[];
} & StorageEnv;

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
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://[::1]:3000",
    "http://[::1]:3001",
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
  const { CORS_ORIGINS, STORAGE_ROOT, STORAGE_MAX_UPLOAD_BYTES, STORAGE_ALLOWED_MIME, ...rest } = parsed;

  const storageRoot =
    STORAGE_ROOT && STORAGE_ROOT.length > 0
      ? path.isAbsolute(STORAGE_ROOT)
        ? STORAGE_ROOT
        : path.resolve(process.cwd(), STORAGE_ROOT)
      : parsed.NODE_ENV === "production"
        ? "/app/data/storage"
        : parsed.NODE_ENV === "test"
          ? path.join(os.tmpdir(), `appbase-api-storage-${randomUUID()}`)
          : path.resolve(process.cwd(), "data/storage");

  const storageMaxUploadBytes = STORAGE_MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024;
  const storageAllowedMime =
    STORAGE_ALLOWED_MIME == null || STORAGE_ALLOWED_MIME.trim() === "" || STORAGE_ALLOWED_MIME.trim() === "*"
      ? null
      : STORAGE_ALLOWED_MIME.trim();

  return {
    ...rest,
    BASE_URL: baseUrl,
    AUTH_SECRET: authSecret ?? "dev-secret-min-32-chars-required-for-auth",
    corsAllowedOrigins: buildCorsAllowedOrigins(CORS_ORIGINS, baseUrl),
    storageRoot,
    storageMaxUploadBytes,
    storageAllowedMime,
    storageDriver: parsed.STORAGE_DRIVER,
  };
}
