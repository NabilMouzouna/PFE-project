import { FileSystemStorageDriver, type StorageDriver } from "@appbase/storage";
import type { AppEnv } from "../config/env";

export function createStorageDriver(env: AppEnv): StorageDriver {
  if (env.storageDriver !== "fs") {
    throw new Error(`Unsupported STORAGE_DRIVER: ${env.storageDriver}`);
  }
  return new FileSystemStorageDriver(env.storageRoot);
}
