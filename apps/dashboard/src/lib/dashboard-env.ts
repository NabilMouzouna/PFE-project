import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  API_BASE_URL: z.string().url(),
  DASHBOARD_API_KEY: z.string().min(1),
});

export function getDashboardServerEnv() {
  return serverEnvSchema.parse({
    API_BASE_URL: process.env.API_BASE_URL,
    DASHBOARD_API_KEY: process.env.DASHBOARD_API_KEY,
  });
}
