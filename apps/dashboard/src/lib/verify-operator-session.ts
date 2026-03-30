import { DASHBOARD_API_SESSION_COOKIE } from "@/lib/dashboard-cookies";
import { getApiBaseUrl } from "@/lib/jwks";
import { verifyOperatorAccessToken } from "@/lib/verify-access-token";

type RefreshJson = { success?: boolean };

/**
 * True only when:
 * 1) dashboard access JWT is valid and admin role, and
 * 2) API-backed session cookie still resolves through /auth/refresh, and
 * 3) API confirms this bearer token still maps to an admin user in DB.
 *
 * This prevents "zombie" dashboard access after API DB/session reset.
 */
export async function verifyOperatorSession(accessToken: string, apiSessionToken?: string): Promise<boolean> {
  const jwtOk = await verifyOperatorAccessToken(accessToken);
  if (!jwtOk) return false;
  if (!apiSessionToken || apiSessionToken.trim().length === 0) return false;

  try {
    const apiBase = getApiBaseUrl();
    const refresh = await fetch(`${apiBase}/auth/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Cookie: `appbase_session=${encodeURIComponent(apiSessionToken)}`,
      },
      cache: "no-store",
    });
    if (!refresh.ok) return false;
    const json = (await refresh.json().catch(() => ({}))) as RefreshJson;
    if (json.success !== true) return false;

    // DB-backed admin check: catches DB resets where JWT signature can still verify.
    const adminCheck = await fetch(`${apiBase}/admin/api-key/setup-status`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    return adminCheck.ok;
  } catch {
    return false;
  }
}

export function readDashboardApiSessionFromCookieStore(getCookie: (name: string) => string | undefined): string | undefined {
  return getCookie(DASHBOARD_API_SESSION_COOKIE);
}
