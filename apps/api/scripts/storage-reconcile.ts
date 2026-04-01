/**
 * Operator helper: list metadata↔disk drift (see docs/STORAGE-OPERATIONS.md).
 * Usage: from repo root, `pnpm --filter api exec tsx scripts/storage-reconcile.ts`
 * (with `.env` or env vars for DB_PATH, STORAGE_ROOT).
 */
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@appbase/db";
import { loadEnv } from "../src/config/env";
import { createStorageDriver } from "../src/storage/factory";
import { reconcileFileStorage } from "../src/storage/reconcile";

const dir = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(dir, "../.env"), quiet: true });

const env = loadEnv(process.env);
const db = createDb(env.DB_PATH);
const driver = createStorageDriver(env);
const report = await reconcileFileStorage(db, driver);
console.log(JSON.stringify(report, null, 2));
db.$client.close();
