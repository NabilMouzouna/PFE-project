import { fetchApiUpstream } from "@/lib/fetch-upstream";
import { getApiBaseUrl } from "@/lib/jwks";
import { nextResponseFromApiAuth } from "@/lib/apply-dashboard-session";

/**
 * First operator only: proxies to API `POST /bootstrap/first-operator`.
 * Set `APPBASE_BOOTSTRAP_SECRET` (or `DASHBOARD_BOOTSTRAP_SECRET`) to match the API when required.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const apiBase = getApiBaseUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const secret =
    process.env.APPBASE_BOOTSTRAP_SECRET?.trim() || process.env.DASHBOARD_BOOTSTRAP_SECRET?.trim();
  if (secret) {
    headers["x-appbase-bootstrap-secret"] = secret;
  }

  const upstream = await fetchApiUpstream(
    `${apiBase}/bootstrap/first-operator`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    apiBase,
  );

  return nextResponseFromApiAuth(upstream, { requireAdminRole: false });
}
