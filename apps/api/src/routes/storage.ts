import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { eq, and, count } from "drizzle-orm";
import { files } from "@appbase/db/schema";
import { validateBucket, isMimeAllowed } from "@appbase/storage";

function apiSuccess<T>(data: T) {
  return { success: true as const, data };
}

function apiError(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

const FILE_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

function toIso(d: Date): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

function toFileRecord(row: typeof files.$inferSelect) {
  return {
    id: row.id,
    bucket: row.bucket,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    ownerId: row.ownerId,
    createdAt: toIso(row.createdAt as unknown as Date),
  };
}

const uploadOpenApi = {
  tags: ["storage"],
  summary: "Upload file",
  description: "Multipart upload (`file` field) into a user-scoped bucket.",
  security: [{ bearerAuth: [] }, { apiKey: [] }],
  consumes: ["multipart/form-data"],
  params: {
    type: "object",
    required: ["bucket"],
    properties: {
      bucket: { type: "string", description: "Bucket name (letters, digits, hyphens, underscores; max 64)." },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data: {
          type: "object",
          properties: {
            file: { type: "object", additionalProperties: true },
            url: { type: "string" },
          },
          required: ["file", "url"],
        },
      },
      required: ["success", "data"],
    },
    400: { type: "object", additionalProperties: true },
    401: { type: "object", additionalProperties: true },
    413: { type: "object", additionalProperties: true },
  },
} as const;

const listOpenApi = {
  tags: ["storage"],
  summary: "List files in bucket",
  security: [{ bearerAuth: [] }, { apiKey: [] }],
  params: {
    type: "object",
    required: ["bucket"],
    properties: { bucket: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data: {
          type: "object",
          properties: {
            files: { type: "array", items: { type: "object", additionalProperties: true } },
            total: { type: "integer" },
          },
          required: ["files", "total"],
        },
      },
      required: ["success", "data"],
    },
    400: { type: "object", additionalProperties: true },
    401: { type: "object", additionalProperties: true },
  },
} as const;

const downloadOpenApi = {
  tags: ["storage"],
  summary: "Download file",
  security: [{ bearerAuth: [] }, { apiKey: [] }],
  params: {
    type: "object",
    required: ["bucket", "fileId"],
    properties: {
      bucket: { type: "string" },
      fileId: { type: "string" },
    },
  },
  response: {
    200: { description: "Binary body", type: "string", format: "binary" },
    400: { type: "object", additionalProperties: true },
    401: { type: "object", additionalProperties: true },
    404: { type: "object", additionalProperties: true },
  },
} as const;

const deleteOpenApi = {
  tags: ["storage"],
  summary: "Delete file",
  security: [{ bearerAuth: [] }, { apiKey: [] }],
  params: {
    type: "object",
    required: ["bucket", "fileId"],
    properties: {
      bucket: { type: "string" },
      fileId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data: {
          type: "object",
          properties: { deleted: { type: "boolean", const: true } },
          required: ["deleted"],
        },
      },
      required: ["success", "data"],
    },
    400: { type: "object", additionalProperties: true },
    401: { type: "object", additionalProperties: true },
    404: { type: "object", additionalProperties: true },
  },
} as const;

export async function registerStorageRoutes(app: FastifyInstance) {
  const driver = app.storageDriver;
  const cfg = app.config;

  // POST /storage/buckets/:bucket/upload
  app.post<{
    Params: { bucket: string };
  }>("/storage/buckets/:bucket/upload", { schema: uploadOpenApi }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
    }

    const { bucket } = request.params;
    const bucketCheck = validateBucket(bucket);
    if (!bucketCheck.valid) {
      return reply.status(400).send(apiError("VALIDATION_ERROR", bucketCheck.error));
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send(apiError("VALIDATION_ERROR", "Multipart field `file` is required"));
    }
    if (file.fieldname !== "file") {
      return reply.status(400).send(apiError("VALIDATION_ERROR", "Multipart field must be named `file`"));
    }

    const mimeType = file.mimetype || "application/octet-stream";
    if (!isMimeAllowed(mimeType, cfg.storageAllowedMime)) {
      return reply.status(400).send(apiError("VALIDATION_ERROR", "MIME type is not allowed by server policy"));
    }

    const filename = file.filename || "upload";
    const id = nanoid();
    const storagePath = `objects/${id}`;

    let putResult: { size: number; checksum: string };
    try {
      putResult = await driver.putObject({ objectKey: storagePath, stream: file.file });
    } catch (err) {
      request.log.error({ err }, "storage.upload.putObject failed");
      return reply.status(500).send(apiError("INTERNAL_ERROR", "Failed to store file"));
    }

    if (putResult.size > cfg.storageMaxUploadBytes) {
      await driver.deleteObject(storagePath).catch(() => {});
      return reply.status(413).send(apiError("PAYLOAD_TOO_LARGE", "File exceeds maximum upload size"));
    }

    const now = new Date();
    await app.db.insert(files).values({
      id,
      logicalFileId: id,
      version: 1,
      bucket,
      filename,
      mimeType,
      size: putResult.size,
      storagePath,
      checksum: putResult.checksum,
      ownerId: userId,
      createdAt: now,
    });

    const url = `/storage/buckets/${bucket}/${id}`;
    request.log.info({ bucket, id, size: putResult.size, userId }, "storage.upload");

    return reply.status(201).send(
      apiSuccess({
        file: {
          id,
          bucket,
          filename,
          mimeType,
          size: putResult.size,
          ownerId: userId,
          createdAt: now.toISOString(),
        },
        url,
      }),
    );
  });

  // GET /storage/buckets/:bucket
  app.get<{ Params: { bucket: string } }>("/storage/buckets/:bucket", { schema: listOpenApi }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
    }

    const { bucket } = request.params;
    const bucketCheck = validateBucket(bucket);
    if (!bucketCheck.valid) {
      return reply.status(400).send(apiError("VALIDATION_ERROR", bucketCheck.error));
    }

    const [rows, totalResult] = await Promise.all([
      app.db
        .select()
        .from(files)
        .where(and(eq(files.bucket, bucket), eq(files.ownerId, userId)))
        .orderBy(files.createdAt),
      app.db
        .select({ count: count() })
        .from(files)
        .where(and(eq(files.bucket, bucket), eq(files.ownerId, userId))),
    ]);

    const total = totalResult[0]?.count ?? 0;
    request.log.info({ bucket, total, userId }, "storage.list");

    return reply.send(apiSuccess({ files: rows.map(toFileRecord), total }));
  });

  // GET /storage/buckets/:bucket/:fileId
  app.get<{ Params: { bucket: string; fileId: string } }>(
    "/storage/buckets/:bucket/:fileId",
    { schema: downloadOpenApi },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
      }

      const { bucket, fileId } = request.params;
      const bucketCheck = validateBucket(bucket);
      if (!bucketCheck.valid) {
        return reply.status(400).send(apiError("VALIDATION_ERROR", bucketCheck.error));
      }
      if (!FILE_ID_REGEX.test(fileId)) {
        return reply.status(400).send(apiError("VALIDATION_ERROR", "Invalid file id"));
      }

      const rows = await app.db
        .select()
        .from(files)
        .where(and(eq(files.id, fileId), eq(files.bucket, bucket), eq(files.ownerId, userId)))
        .limit(1);

      if (rows.length === 0) {
        return reply.status(404).send(apiError("NOT_FOUND", "File not found"));
      }

      const row = rows[0]!;
      if (!(await driver.exists(row.storagePath))) {
        return reply.status(404).send(apiError("NOT_FOUND", "File data is missing"));
      }

      request.log.info({ bucket, fileId, userId }, "storage.download");
      const stream = driver.getObjectStream(row.storagePath);
      return reply.header("Content-Type", row.mimeType).send(stream);
    },
  );

  // DELETE /storage/buckets/:bucket/:fileId
  app.delete<{ Params: { bucket: string; fileId: string } }>(
    "/storage/buckets/:bucket/:fileId",
    { schema: deleteOpenApi },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.status(401).send(apiError("INVALID_TOKEN", "The provided access token is invalid or expired."));
      }

      const { bucket, fileId } = request.params;
      const bucketCheck = validateBucket(bucket);
      if (!bucketCheck.valid) {
        return reply.status(400).send(apiError("VALIDATION_ERROR", bucketCheck.error));
      }
      if (!FILE_ID_REGEX.test(fileId)) {
        return reply.status(400).send(apiError("VALIDATION_ERROR", "Invalid file id"));
      }

      const rows = await app.db
        .select()
        .from(files)
        .where(and(eq(files.id, fileId), eq(files.bucket, bucket), eq(files.ownerId, userId)))
        .limit(1);

      if (rows.length === 0) {
        return reply.status(404).send(apiError("NOT_FOUND", "File not found"));
      }

      const row = rows[0]!;
      await app.db.delete(files).where(and(eq(files.id, fileId), eq(files.ownerId, userId)));
      await driver.deleteObject(row.storagePath).catch((err) => {
        request.log.warn({ err, storagePath: row.storagePath }, "storage.delete.object_cleanup_failed");
      });

      request.log.info({ bucket, fileId, userId }, "storage.delete");
      return reply.send(apiSuccess({ deleted: true }));
    },
  );
}
