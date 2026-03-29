import "server-only";
import { getDashboardServerEnv } from "./dashboard-env";

export async function serverApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const { API_BASE_URL, DASHBOARD_API_KEY } = getDashboardServerEnv();
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("x-api-key", DASHBOARD_API_KEY);
  headers.set("Accept", "application/json");
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${base}${p}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function serverPublicFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${base}${p}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}
