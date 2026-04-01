import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env";
import { ensureStorageRootReady } from "../utils/filesystem";
import { createStorageDriver } from "../storage/factory";

export async function registerStorage(app: FastifyInstance, env: AppEnv) {
  ensureStorageRootReady(env.storageRoot);

  if (env.NODE_ENV === "production" && !env.storageRoot.startsWith("/app/data")) {
    app.log.warn(
      { storageRoot: env.storageRoot },
      "STORAGE_ROOT is outside /app/data; ensure a persistent volume is mounted. See docs/adr/ADR-005-file-storage-strategy.md.",
    );
  }

  const driver = createStorageDriver(env);
  app.decorate("storageDriver", driver);

  app.log.info(
    {
      storageRoot: env.storageRoot,
      storageRootResolved: path.resolve(env.storageRoot),
    },
    "storage.driver.ready",
  );
}
