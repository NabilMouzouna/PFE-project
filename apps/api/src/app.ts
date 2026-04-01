import Fastify, { type FastifyInstance } from "fastify";
import { createLoggerConfig } from "./config/logger";
import type { AppEnv } from "./config/env";
import { registerMiddleware } from "./middleware";
import { registerDatabase } from "./plugins/database";
import { registerInfrastructure } from "./plugins/infrastructure";
import { registerAuth } from "./plugins/auth";
import { registerStorage } from "./plugins/storage";
import { ensureInstanceApiKeyAtStartup } from "./bootstrap/ensure-instance-api-key";
import { registerRoutes } from "./routes";

export interface BuildAppOptions {
  env: AppEnv;
}

export async function buildApp({ env }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: createLoggerConfig(env),
  });

  app.decorate("config", env);

  await registerDatabase(app, env);
  await registerAuth(app, env);
  await registerInfrastructure(app, env);
  await registerStorage(app, env);
  await registerRoutes(app);
  registerMiddleware(app);

  app.addHook("onReady", async () => {
    await ensureInstanceApiKeyAtStartup(app);
  });

  return app;
}
