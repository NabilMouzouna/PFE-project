import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { auditLog, user } from "@appbase/db/schema";
import type { Auth } from "../lib/auth";
import {
  ACCESS_TOKEN_EXPIRY_SECONDS,
  AUTH_INTERNAL_PATHS,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "../constants";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function apiSuccess<T>(data: T) {
  return { success: true as const, data };
}

function apiError(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

function setSessionCookie(reply: FastifyReply, token: string, nodeEnv: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    secure: nodeEnv === "production",
  });
}

async function getJwtFromSession(auth: Auth, sessionToken: string, baseUrl: string): Promise<string | null> {
  const url = `${baseUrl}${AUTH_INTERNAL_PATHS.token}`;
  const req = new Request(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const res = await auth.handler(req);
  if (!res.ok) return null;
  const json = (await res.json()) as { token?: string };
  return json.token ?? null;
}

function parseCustomIdentity(metadata: string | null | undefined): Record<string, string> | undefined {
  if (metadata == null || metadata === "" || metadata === "{}") return undefined;
  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") out[k] = v;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

function formatUser(u: {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: string | null;
  role?: string | null;
  banned?: boolean | null;
  emailVerified?: boolean | null;
}) {
  const customIdentity = parseCustomIdentity(u.metadata);
  return {
    id: u.id,
    email: u.email,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
    role: u.role ?? null,
    banned: u.banned ?? null,
    emailVerified: u.emailVerified ?? null,
    ...(customIdentity != null ? { customIdentity } : {}),
  };
}

function verifyBootstrapSecret(request: FastifyRequest, app: FastifyInstance): boolean {
  const cfg = app.config;
  const provided =
    typeof request.headers["x-appbase-bootstrap-secret"] === "string"
      ? request.headers["x-appbase-bootstrap-secret"]
      : "";

  if (cfg.NODE_ENV === "production") {
    return cfg.bootstrapSecret != null && provided === cfg.bootstrapSecret;
  }

  if (cfg.bootstrapSecret != null && cfg.bootstrapSecret.length > 0) {
    return provided === cfg.bootstrapSecret;
  }

  return true;
}

/**
 * One-time first operator: creates user + admin role when no admin exists.
 * No x-api-key. Production requires APPBASE_BOOTSTRAP_SECRET and matching header.
 */
export async function registerBootstrapRoutes(app: FastifyInstance) {
  const { auth } = app;
  const baseUrl = app.config.BASE_URL;
  const nodeEnv = app.config.NODE_ENV;

  app.post<{ Body: unknown }>("/bootstrap/first-operator", async (request, reply) => {
    if (app.config.NODE_ENV === "production" && !app.config.bootstrapSecret) {
      return reply.status(503).send(
        apiError("BOOTSTRAP_DISABLED", "First-operator bootstrap is disabled (set APPBASE_BOOTSTRAP_SECRET)."),
      );
    }

    if (!verifyBootstrapSecret(request, app)) {
      return reply.status(401).send(apiError("UNAUTHORIZED", "Invalid or missing bootstrap secret."));
    }

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return reply.status(400).send(apiError("VALIDATION_ERROR", msg));
    }

    const { email, password } = parsed.data;

    const adminRows = await app.db
      .select({ c: count() })
      .from(user)
      .where(eq(user.role, "admin"));
    const adminCount = Number(adminRows[0]?.c ?? 0);
    if (adminCount > 0) {
      return reply
        .status(403)
        .send(apiError("BOOTSTRAP_ALREADY_DONE", "An operator already exists. Sign in instead."));
    }

    try {
      await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: "",
          metadata: "{}",
        },
      });
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
      if (msg.includes("already") || msg.includes("exists") || msg.includes("unique")) {
        return reply.status(409).send(apiError("CONFLICT", "A user with this email already exists."));
      }
      return reply.status(400).send(apiError("VALIDATION_ERROR", msg || "Invalid request"));
    }

    const now = new Date();
    await app.db.update(user).set({ role: "admin", updatedAt: now }).where(eq(user.email, email));

    let session: {
      token: string;
      user: {
        id: string;
        email: string;
        createdAt: Date;
        updatedAt: Date;
        metadata?: string | null;
        role?: string | null;
        banned?: boolean | null;
        emailVerified?: boolean | null;
      };
    };
    try {
      session = await auth.api.signInEmail({
        body: { email, password },
      }) as typeof session;
    } catch {
      return reply.status(500).send(apiError("INTERNAL_ERROR", "Failed to sign in after bootstrap."));
    }

    const jwt = await getJwtFromSession(auth, session.token, baseUrl);
    if (!jwt) {
      return reply.status(500).send(apiError("INTERNAL_ERROR", "Failed to obtain access token"));
    }

    await app.db.insert(auditLog).values({
      id: randomUUID(),
      action: "operator.bootstrap_first",
      userId: session.user.id,
      resource: "users",
      resourceId: session.user.id,
      metadata: {},
      createdAt: now,
    });

    setSessionCookie(reply, session.token, nodeEnv);
    return reply.status(201).send(
      apiSuccess({
        accessToken: jwt,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
        user: formatUser({ ...session.user, role: "admin" }),
      }),
    );
  });
}
