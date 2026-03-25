import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";
import { registerAuthRoutes } from "./auth";
import { registerDbRoutes } from "./db";
import { registerStorageRoutes } from "./storage";

export async function registerRoutes(app: FastifyInstance) {
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerDbRoutes(app);
  await registerStorageRoutes(app);
}
