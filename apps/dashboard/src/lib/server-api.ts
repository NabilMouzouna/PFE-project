import "server-only";
import { getDashboardServerEnv } from "./dashboard-env";
import { validateDashboardApiKeyForHeader } from "./dashboard-api-key-header";

export async function serverApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const { API_BASE_URL, DASHBOARD_API_KEY } = getDashboardServerEnv();
  if (!DASHBOARD_API_KEY) {
    return Response.json(
      {
        success: false,
        error: {
          code: "DASHBOARD_API_KEY_MISSING",
          message:
            "Set DASHBOARD_API_KEY in apps/dashboard/.env to the full instance API key (from the API log line when the server started, or from Settings → API key after Regenerate). Restart the dev server after saving.",
        },
      },
      { status: 503 },
    );
  }

  const keyCheck = validateDashboardApiKeyForHeader(DASHBOARD_API_KEY);
  if (!keyCheck.ok) {
    return Response.json(
      {
        success: false,
        error: {
          code: "INVALID_DASHBOARD_API_KEY",
          message:
            keyCheck.code === "NON_LATIN1"
              ? "DASHBOARD_API_KEY is not a valid HTTP header value. You may have pasted the masked preview (with bullet dots) instead of the full secret. Use the raw key from the API startup log, or open Settings → API key → Regenerate and paste the new hs_live_… value once."
              : "DASHBOARD_API_KEY is empty after trimming. Remove it or set the full instance key.",
        },
      },
      { status: 503 },
    );
  }

  const base = API_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("x-api-key", keyCheck.value);
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
