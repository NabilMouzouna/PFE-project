import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";
import { registerBootstrapRoutes } from "./bootstrap";
import { registerAuthRoutes } from "./auth";
import { registerDbRoutes } from "./db";
import { registerStorageRoutes } from "./storage";
import { registerAdminRoutes } from "./admin";

export async function registerRoutes(app: FastifyInstance) {
  await registerHealthRoutes(app);
  await registerBootstrapRoutes(app);
  await registerAuthRoutes(app);
  await registerDbRoutes(app);
  await registerStorageRoutes(app);
  await registerAdminRoutes(app);
}
