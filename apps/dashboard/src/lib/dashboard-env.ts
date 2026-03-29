import "server-only";
import { z } from "zod";

function readDashboardApiKey(): string {
  const a = process.env.DASHBOARD_API_KEY?.trim();
  const b = process.env.INTERNAL_API_KEY?.trim();
  return a || b || "";
}

export type DashboardServerEnv = {
  API_BASE_URL: string;
  /** When null, admin BFF routes that only use `x-api-key` are unavailable until the key is set. */
  DASHBOARD_API_KEY: string | null;
};

export function getDashboardServerEnv(): DashboardServerEnv {
  const API_BASE_URL = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").trim();
  const key = readDashboardApiKey();

  const urlResult = z.string().url().safeParse(API_BASE_URL);
  if (!urlResult.success) {
    throw new Error(`Invalid API_BASE_URL: ${API_BASE_URL}`);
  }

  return {
    API_BASE_URL,
    DASHBOARD_API_KEY: key.length > 0 ? key : null,
  };
}
