import type { AppDb } from "@appbase/db";
import type { AppEnv } from "../config/env";
import type { Auth } from "../lib/auth";
import type { StorageDriver } from "@appbase/storage";

declare module "fastify" {
  interface FastifyInstance {
    db: AppDb;
    config: AppEnv;
    auth: Auth;
    storageDriver: StorageDriver;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    apiKey?: { id: string; [key: string]: unknown };
    userId?: string;
    appId?: string;
  }
}

export {};
