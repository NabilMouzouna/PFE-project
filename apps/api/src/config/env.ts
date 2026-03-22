import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().min(1).default("data/appbase.sqlite"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  BASE_URL: z.string().url().optional(),
  /** Comma-separated list of allowed browser origins for credentialed CORS (e.g. `http://localhost:3001`). */
  CORS_ORIGINS: z.string().optional(),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters")
    .optional(),
});

type ParsedEnv = z.output<typeof envSchema>;

export type AppEnv = Omit<ParsedEnv, "BASE_URL" | "AUTH_SECRET" | "CORS_ORIGINS"> & {
  BASE_URL: string;
  AUTH_SECRET: string;
  corsAllowedOrigins: string[];
};

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
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
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
  const { CORS_ORIGINS, ...rest } = parsed;

  return {
    ...rest,
    BASE_URL: baseUrl,
    AUTH_SECRET: authSecret ?? "dev-secret-min-32-chars-required-for-auth",
    corsAllowedOrigins: buildCorsAllowedOrigins(CORS_ORIGINS, baseUrl),
  };
}
