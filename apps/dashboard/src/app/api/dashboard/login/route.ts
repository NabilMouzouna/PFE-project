import { fetchApiUpstream } from "@/lib/fetch-upstream";
import { getApiBaseUrl } from "@/lib/jwks";
import { nextResponseFromApiAuth } from "@/lib/apply-dashboard-session";

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
  const upstream = await fetchApiUpstream(
    `${apiBase}/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    },
    apiBase,
  );

  return nextResponseFromApiAuth(upstream, { requireAdminRole: true });
}
