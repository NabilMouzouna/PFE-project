import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env";
import { createStorageDriver } from "../storage/factory";

export async function registerStorage(app: FastifyInstance, env: AppEnv) {
  fs.mkdirSync(env.storageRoot, { recursive: true });
  const probe = path.join(env.storageRoot, ".write-check");
  try {
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
  } catch {
    throw new Error(`Storage root is not writable: ${env.storageRoot}`);
  }

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
