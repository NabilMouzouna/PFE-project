import { files } from "@appbase/db/schema";
import type { AppDb } from "@appbase/db";
import { FileSystemStorageDriver, type StorageDriver } from "@appbase/storage";

export type ReconcileReport = {
  /** `files.id` rows whose object key is missing on disk */
  metadataMissingObject: string[];
  /** Relative object keys present on disk but not referenced by any `files.storage_path` */
  objectWithoutMetadata: string[];
};

/**
 * Detects inconsistent storage vs metadata. FS driver: compares DB `storage_path` with files under `objects/`.
 * For future S3 adapters, replace disk scan with bucket listing or admin tooling.
 */
export async function reconcileFileStorage(db: AppDb, driver: StorageDriver): Promise<ReconcileReport> {
  const rows = await db.select({ id: files.id, storagePath: files.storagePath }).from(files);
  const pathSet = new Set(rows.map((r) => r.storagePath));

  const metadataMissingObject: string[] = [];
  for (const row of rows) {
    if (!(await driver.exists(row.storagePath))) {
      metadataMissingObject.push(row.id);
    }
  }

  let objectWithoutMetadata: string[] = [];
  if (driver instanceof FileSystemStorageDriver) {
    const onDisk = await driver.listStoredObjectKeys();
    objectWithoutMetadata = onDisk.filter((k) => !pathSet.has(k));
  }

  return { metadataMissingObject, objectWithoutMetadata };
}
