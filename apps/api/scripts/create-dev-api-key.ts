/**
 * Legacy CLI: creates an instance API key in the DB.
 * Prefer the operator dashboard: Settings → API key → Generate (no env required for first key).
 *
 * Use this script only for automation/CI. Start the API once so the DB exists.
 * Run: pnpm --filter api exec tsx scripts/create-dev-api-key.ts
 */
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@appbase/db";
import * as schema from "@appbase/db/schema";
import { createAuth } from "../src/lib/auth";
import { loadEnv } from "../src/config/env";
import { API_KEY_INSTANCE_USER_ID } from "../src/constants/bootstrap-user";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, "../.env"), quiet: true });

const env = loadEnv(process.env);
const db = createDb(env.DB_PATH);

async function ensureBootstrapUser() {
  const users = await db.select().from(schema.user);
  if (users.some((u) => u.id === API_KEY_INSTANCE_USER_ID)) return;

  const now = new Date();
  await db.insert(schema.user).values({
    id: API_KEY_INSTANCE_USER_ID,
    name: "App Bootstrap",
    email: "bootstrap@appbase.local",
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
}

async function main() {
  await ensureBootstrapUser();

  const auth = createAuth(db, env.BASE_URL, env.AUTH_SECRET);
  const result = await auth.api.createApiKey({
    body: {
      name: "dev-api-key",
      userId: API_KEY_INSTANCE_USER_ID,
    },
  });

  const key = (result as { key?: string })?.key;
  if (!key) {
    console.error("Failed to create API key");
    process.exit(1);
  }

  console.log("\nAPI key created. Add to api.http:\n");
  console.log(`  @apiKey = ${key}\n`);
  console.log("Then add header to each request: x-api-key: {{apiKey}}\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
