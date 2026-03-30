import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  /** Same as `id` for M1 uploads; future versioned uploads share the same logical id across rows. */
  logicalFileId: text("logical_file_id").notNull(),
  version: integer("version").notNull().default(1),
  bucket: text("bucket").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  /** Relative object key passed to the storage driver (opaque, ID-based). */
  storagePath: text("storage_path").notNull(),
  /** SHA-256 hex of stored bytes (optional for legacy rows). */
  checksum: text("checksum"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
