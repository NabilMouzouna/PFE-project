/**
 * Grant better-auth admin role to a user by email (operator console access).
 * Run: pnpm --filter api exec tsx scripts/promote-operator-admin.ts user@example.com
 */
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { createDb } from "@appbase/db";
import { user } from "@appbase/db/schema";
import { loadEnv } from "../src/config/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, "../.env"), quiet: true });

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error("Usage: tsx scripts/promote-operator-admin.ts <email>");
    process.exit(1);
  }

  const env = loadEnv(process.env);
  const db = createDb(env.DB_PATH);
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (!rows[0]) {
    console.error(`No user with email: ${email}`);
    process.exit(1);
  }
  await db.update(user).set({ role: "admin", updatedAt: new Date() }).where(eq(user.id, rows[0].id));
  console.log(`Updated ${email} → role admin. Use this account to sign in at the dashboard.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
