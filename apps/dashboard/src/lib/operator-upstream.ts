import "server-only";
import { fetchApiUpstream } from "@/lib/fetch-upstream";
import { getApiBaseUrl } from "@/lib/jwks";

/** Calls the AppBase API with the operator access JWT (no `x-api-key`). */
export async function fetchAsOperator(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetchApiUpstream(`${base}${p}`, { ...init, headers }, base);
}
