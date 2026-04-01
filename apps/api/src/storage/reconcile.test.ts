import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";
import { createDb } from "@appbase/db";
import { files, user } from "@appbase/db/schema";
import { FileSystemStorageDriver } from "@appbase/storage";
import { reconcileFileStorage } from "./reconcile";

describe("reconcileFileStorage", () => {
  let tmp: string;
  let db: ReturnType<typeof createDb>;
  let driver: FileSystemStorageDriver;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "appbase-recon-"));
    const dbPath = path.join(tmp, "test.sqlite");
    db = createDb(dbPath);
    driver = new FileSystemStorageDriver(path.join(tmp, "blobs"));
    await db.insert(user).values({
      id: "user1",
      email: `recon-${Date.now()}-${Math.random()}@t.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    db.$client.close();
  });

  it("reports metadata rows whose object is missing on disk", async () => {
    await db.insert(files).values({
      id: "file_meta_only",
      logicalFileId: "file_meta_only",
      version: 1,
      bucket: "b",
      filename: "x.txt",
      mimeType: "text/plain",
      size: 1,
      storagePath: "objects/ghost",
      ownerId: "user1",
      createdAt: new Date(),
    });

    const report = await reconcileFileStorage(db, driver);
    expect(report.metadataMissingObject).toContain("file_meta_only");
    expect(report.objectWithoutMetadata).toEqual([]);
  });

  it("reports on-disk objects not referenced by metadata", async () => {
    fs.mkdirSync(path.join(tmp, "blobs", "objects"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "blobs", "objects", "orphan"), "data");
    const report = await reconcileFileStorage(db, driver);
    expect(report.objectWithoutMetadata).toContain("objects/orphan");
  });

  it("is consistent when row and bytes exist", async () => {
    await driver.putObject({ objectKey: "objects/real1", stream: Readable.from(Buffer.from("ok")) });
    await db.insert(files).values({
      id: "real1",
      logicalFileId: "real1",
      version: 1,
      bucket: "b",
      filename: "f.bin",
      mimeType: "application/octet-stream",
      size: 2,
      storagePath: "objects/real1",
      ownerId: "user1",
      createdAt: new Date(),
    });
    const report = await reconcileFileStorage(db, driver);
    expect(report.metadataMissingObject).toEqual([]);
    expect(report.objectWithoutMetadata).toEqual([]);
  });
});
