import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { eq, ne, desc, sql, count, and } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { user, account, files, auditLog, apiKeys } from "@appbase/db/schema";
import { API_KEY_PREFIX } from "../constants";
import { API_KEY_INSTANCE_USER_ID } from "../constants/bootstrap-user";
import { resolveInstanceApiKeyAccess } from "../lib/instance-api-key-access";
import { requireAdminAccess } from "../lib/require-admin-access";
import { getBearerToken, verifyAdminAccessToken } from "../lib/verify-admin-access-token";

const apiErrorSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", const: false },
    error: {
      type: "object",
      properties: { code: { type: "string" }, message: { type: "string" } },
      required: ["code", "message"],
    },
  },
  required: ["success", "error"],
} as const;

/** OpenAPI `security`; each entry is one of the named security schemes (alternate auth paths). */
const adminSecurity: ReadonlyArray<Record<string, readonly string[]>> = [{ apiKey: [] }, { bearerAuth: [] }];
/** OpenAPI `security`; each entry is one of the named security schemes (alternate auth paths). */
const instanceKeySecurity: ReadonlyArray<Record<string, readonly string[]>> = [{ apiKey: [] }, { bearerAuth: [] }];

function apiSuccess<T>(data: T) {
  return { success: true as const, data };
}

function apiError(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

/** Public hint only — never include key material from `api_keys.start` (can mirror prefix and confuse UIs). */
function maskInstanceKey(prefix: string | null | undefined): string {
  const p = prefix && prefix.length > 0 ? prefix : API_KEY_PREFIX;
  return `${p}••••••••••••`;
}

const rotateBodySchema = z.object({}).strict();

const setPasswordBodySchema = z.object({
  newPassword: z.string().min(8).max(128),
});

async function ensureApiKeyBootstrapUser(app: FastifyInstance): Promise<void> {
  const existing = await app.db.select({ id: user.id }).from(user).where(eq(user.id, API_KEY_INSTANCE_USER_ID)).limit(1);
  if (existing[0]) return;
  const now = new Date();
  await app.db.insert(user).values({
    id: API_KEY_INSTANCE_USER_ID,
    name: "App Bootstrap",
    email: "bootstrap@appbase.local",
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get(
    "/admin/users",
    {
      schema: {
        tags: ["admin"],
        summary: "List users",
        description:
          "End-users and operators. The internal instance API-key user (bootstrap@appbase.local) is omitted.",
        security: adminSecurity,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                properties: {
                  users: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        email: { type: "string" },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                        role: { type: "string", nullable: true },
                        banned: { type: "boolean", nullable: true },
                        emailVerified: { type: "boolean" },
                      },
                      required: ["id", "email", "createdAt", "updatedAt", "emailVerified"],
                    },
                  },
                },
                required: ["users"],
              },
            },
            required: ["success", "data"],
          },
          401: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await requireAdminAccess(request, reply, app))) return;
      const rows = await app.db
        .select({
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          role: user.role,
          banned: user.banned,
          emailVerified: user.emailVerified,
        })
        .from(user)
        .where(ne(user.id, API_KEY_INSTANCE_USER_ID))
        .orderBy(user.createdAt);

      const users = rows.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
        updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : String(u.updatedAt),
        role: u.role ?? null,
        banned: u.banned ?? null,
        emailVerified: Boolean(u.emailVerified),
      }));

      return apiSuccess({ users });
    },
  );

  app.get(
    "/admin/storage/usage",
    {
      schema: {
        tags: ["admin"],
        summary: "Storage usage",
        security: adminSecurity,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                properties: {
                  totalFiles: { type: "integer" },
                  totalBytes: { type: "integer" },
                  byBucket: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        bucket: { type: "string" },
                        fileCount: { type: "integer" },
                        totalBytes: { type: "integer" },
                      },
                      required: ["bucket", "fileCount", "totalBytes"],
                    },
                  },
                },
                required: ["totalFiles", "totalBytes", "byBucket"],
              },
            },
            required: ["success", "data"],
          },
          401: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await requireAdminAccess(request, reply, app))) return;
      const byBucketRows = await app.db
        .select({
          bucket: files.bucket,
          fileCount: count(),
          totalBytes: sql<number>`coalesce(sum(${files.size}), 0)`.mapWith(Number),
        })
        .from(files)
        .groupBy(files.bucket);

      const totals = await app.db
        .select({
          totalFiles: count(),
          totalBytes: sql<number>`coalesce(sum(${files.size}), 0)`.mapWith(Number),
        })
        .from(files);

      const t = totals[0] ?? { totalFiles: 0, totalBytes: 0 };

      return apiSuccess({
        totalFiles: Number(t.totalFiles),
        totalBytes: Number(t.totalBytes),
        byBucket: byBucketRows.map((r) => ({
          bucket: r.bucket,
          fileCount: Number(r.fileCount),
          totalBytes: Number(r.totalBytes),
        })),
      });
    },
  );

  app.get<{ Querystring: { limit?: string; offset?: string; action?: string } }>(
    "/admin/audit-log",
    {
      schema: {
        tags: ["admin"],
        summary: "Audit log",
        security: adminSecurity,
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string" },
            offset: { type: "string" },
            action: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                properties: {
                  items: { type: "array" },
                  total: { type: "integer" },
                  limit: { type: "integer" },
                  offset: { type: "integer" },
                },
                required: ["items", "total", "limit", "offset"],
              },
            },
            required: ["success", "data"],
          },
          401: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await requireAdminAccess(request, reply, app))) return;
      const limitRaw = request.query.limit != null ? Number(request.query.limit) : 50;
      const offsetRaw = request.query.offset != null ? Number(request.query.offset) : 0;
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 50;
      const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
      const actionFilter = request.query.action?.trim();

      const whereClause = actionFilter ? eq(auditLog.action, actionFilter) : undefined;

      const countRow = await app.db
        .select({ c: count() })
        .from(auditLog)
        .where(whereClause);

      const total = Number(countRow[0]?.c ?? 0);

      const items = await app.db
        .select()
        .from(auditLog)
        .where(whereClause)
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset);

      return apiSuccess({
        items: items.map((row) => ({
          id: row.id,
          action: row.action,
          userId: row.userId ?? null,
          resource: row.resource,
          resourceId: row.resourceId ?? null,
          metadata: row.metadata ?? null,
          createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        })),
        total,
        limit,
        offset,
      });
    },
  );

  app.get(
    "/admin/api-key/setup-status",
    {
      schema: {
        tags: ["admin"],
        summary: "Instance API key status (operator JWT)",
        description:
          "For the operator console before `x-api-key` is configured. Requires admin Bearer token only.",
        security: [{ bearerAuth: [] as string[] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["missing", "active"] },
                  keyPrefix: { type: "string" },
                  masked: { type: "string" },
                  lastRotatedAt: { type: "string", format: "date-time", nullable: true },
                },
                required: ["status"],
              },
            },
            required: ["success", "data"],
          },
          401: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const bearer = getBearerToken(request);
      if (!bearer || !(await verifyAdminAccessToken(bearer, app))) {
        return reply.status(401).send(apiError("UNAUTHORIZED", "Admin access token required."));
      }

      const rows = await app.db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.referenceId, API_KEY_INSTANCE_USER_ID))
        .limit(1);
      const row = rows[0];
      if (!row) {
        return apiSuccess({ status: "missing" as const });
      }

      const keyPrefix = row.prefix && row.prefix.length > 0 ? row.prefix : API_KEY_PREFIX;
      const masked = maskInstanceKey(row.prefix);
      const lastRotatedAt =
        row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt != null ? String(row.updatedAt) : null;

      return apiSuccess({
        status: "active" as const,
        keyPrefix,
        masked,
        lastRotatedAt,
      });
    },
  );

  app.post<{ Body: unknown }>(
    "/admin/api-key/bootstrap",
    {
      schema: {
        tags: ["admin"],
        summary: "Create first instance API key (operator JWT)",
        description:
          "One-time when no instance key exists. Use the operator dashboard; then copy the key for the SDK and optionally set DASHBOARD_API_KEY.",
        security: [{ bearerAuth: [] as string[] }],
        body: { type: "object", additionalProperties: true },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: { type: "object", properties: { key: { type: "string" } }, required: ["key"] },
            },
            required: ["success", "data"],
          },
          401: apiErrorSchema,
          409: apiErrorSchema,
          500: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const bearer = getBearerToken(request);
      if (!bearer || !(await verifyAdminAccessToken(bearer, app))) {
        return reply.status(401).send(apiError("UNAUTHORIZED", "Admin access token required."));
      }

      const existing = await app.db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.referenceId, API_KEY_INSTANCE_USER_ID))
        .limit(1);
      if (existing[0]) {
        return reply
          .status(409)
          .send(
            apiError(
              "ALREADY_EXISTS",
              "An instance API key already exists. Use Regenerate in the console or x-api-key with GET /admin/api-key.",
            ),
          );
      }

      await ensureApiKeyBootstrapUser(app);

      try {
        const created = (await app.auth.api.createApiKey({
          body: {
            name: "instance",
            userId: API_KEY_INSTANCE_USER_ID,
          },
        })) as { key?: string };

        const newKey = created.key;
        if (!newKey) {
          return reply.status(500).send(apiError("INTERNAL_ERROR", "Failed to create instance API key."));
        }

        const now = new Date();
        await app.db.insert(auditLog).values({
          id: randomUUID(),
          action: "api_key.bootstrap",
          userId: null,
          resource: "api_keys",
          resourceId: API_KEY_INSTANCE_USER_ID,
          metadata: {},
          createdAt: now,
        });

        return apiSuccess({ key: newKey });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        request.log.error({ err }, "admin.api_key.bootstrap.failed");
        return reply.status(500).send(apiError("INTERNAL_ERROR", msg || "Bootstrap failed."));
      }
    },
  );

  app.get(
    "/admin/api-key",
    {
      schema: {
        tags: ["admin"],
        summary: "Instance API key metadata",
        security: instanceKeySecurity,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                properties: {
                  keyPrefix: { type: "string" },
                  masked: { type: "string" },
                  lastRotatedAt: { type: "string", format: "date-time", nullable: true },
                },
                required: ["keyPrefix", "masked"],
              },
            },
            required: ["success", "data"],
          },
          401: apiErrorSchema,
          403: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const access = await resolveInstanceApiKeyAccess(request, reply, app);
      if (!access) return;

      const row = access.row;
      const keyPrefix = row.prefix && row.prefix.length > 0 ? row.prefix : API_KEY_PREFIX;
      const masked = maskInstanceKey(row.prefix);
      const lastRotatedAt =
        row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt != null ? String(row.updatedAt) : null;

      return apiSuccess({
        keyPrefix,
        masked,
        lastRotatedAt,
      });
    },
  );

  app.post<{ Body: unknown }>(
    "/admin/api-key/rotate",
    {
      schema: {
        tags: ["admin"],
        summary: "Rotate instance API key",
        security: instanceKeySecurity,
        body: { type: "object", additionalProperties: true },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                properties: { key: { type: "string" } },
                required: ["key"],
              },
            },
            required: ["success", "data"],
          },
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          404: apiErrorSchema,
          500: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = rotateBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send(apiError("VALIDATION_ERROR", "Invalid body."));
      }

      const access = await resolveInstanceApiKeyAccess(request, reply, app);
      if (!access) return;

      const referenceId = access.referenceId;

      try {
        await app.db.delete(apiKeys).where(eq(apiKeys.referenceId, referenceId));

        const created = (await app.auth.api.createApiKey({
          body: {
            name: "instance",
            userId: referenceId,
          },
        })) as { key?: string };

        const newKey = created.key;
        if (!newKey) {
          return reply.status(500).send(apiError("INTERNAL_ERROR", "Failed to create replacement API key."));
        }

        const now = new Date();
        await app.db.insert(auditLog).values({
          id: randomUUID(),
          action: "api_key.rotate",
          userId: null,
          resource: "api_keys",
          resourceId: referenceId,
          metadata: {},
          createdAt: now,
        });

        return apiSuccess({ key: newKey });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        request.log.error({ err }, "admin.api_key.rotate.failed");
        return reply.status(500).send(apiError("INTERNAL_ERROR", msg || "Rotation failed."));
      }
    },
  );

  app.post<{ Params: { id: string }; Body: unknown }>(
    "/admin/users/:id/password",
    {
      schema: {
        tags: ["admin"],
        summary: "Set user password (admin)",
        security: adminSecurity,
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["newPassword"],
          properties: { newPassword: { type: "string", minLength: 8, maxLength: 128 } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: { type: "object", properties: { updated: { type: "boolean", const: true } }, required: ["updated"] },
            },
            required: ["success", "data"],
          },
          400: apiErrorSchema,
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await requireAdminAccess(request, reply, app))) return;
      const parsed = setPasswordBodySchema.safeParse(request.body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join("; ");
        return reply.status(400).send(apiError("VALIDATION_ERROR", msg));
      }

      const userId = request.params.id;
      const existing = await app.db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
      if (!existing[0]) {
        return reply.status(404).send(apiError("NOT_FOUND", "User not found."));
      }

      const minLen = 8;
      const maxLen = 128;
      if (parsed.data.newPassword.length < minLen) {
        return reply.status(400).send(apiError("VALIDATION_ERROR", "Password is too short."));
      }
      if (parsed.data.newPassword.length > maxLen) {
        return reply.status(400).send(apiError("VALIDATION_ERROR", "Password is too long."));
      }

      const credRows = await app.db
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
        .limit(1);
      if (!credRows[0]) {
        return reply
          .status(400)
          .send(apiError("VALIDATION_ERROR", "No email/password account found for this user."));
      }

      try {
        const hashed = await hashPassword(parsed.data.newPassword);
        await app.db
          .update(account)
          .set({ password: hashed, updatedAt: new Date() })
          .where(eq(account.id, credRows[0].id));
      } catch (err: unknown) {
        request.log.warn({ err }, "admin.set_password.failed");
        return reply.status(400).send(apiError("VALIDATION_ERROR", "Could not set password."));
      }

      const now = new Date();
      await app.db.insert(auditLog).values({
        id: randomUUID(),
        action: "user.password_set_by_admin",
        userId: null,
        resource: "users",
        resourceId: userId,
        metadata: {},
        createdAt: now,
      });

      return apiSuccess({ updated: true as const });
    },
  );
}
