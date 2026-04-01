import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Monorepo root — required so `outputFileTracingRoot` resolves pnpm workspace deps correctly. */
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Standalone output (Next 16.2.x): `apps/dashboard/.next/standalone/apps/dashboard/server.js`
 * Copy `.next/static` → `standalone/apps/dashboard/.next/static` in the image; run `node server.js`
 * with cwd `.../standalone/apps/dashboard` and `API_BASE_URL` set at container start (not at build).
 */
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@appbase-pfe/types", "@appbase-pfe/sdk"],
};

export default nextConfig;
