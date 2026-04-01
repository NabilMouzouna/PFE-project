import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DASHBOARD_ACCESS_COOKIE, DASHBOARD_API_SESSION_COOKIE } from "@/lib/dashboard-cookies";
import { getApiBaseUrl } from "@/lib/jwks";

const SESSION_COOKIE_NAME = "appbase_session";

export async function POST() {
  const store = await cookies();
  const session = store.get(DASHBOARD_API_SESSION_COOKIE)?.value;
  const apiBase = getApiBaseUrl();

  if (session) {
    await fetch(`${apiBase}/auth/logout`, {
      method: "POST",
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${session}` },
      cache: "no-store",
    });
  }

  const out = NextResponse.json({ success: true, data: { loggedOut: true as const } });
  out.cookies.delete(DASHBOARD_ACCESS_COOKIE);
  out.cookies.delete(DASHBOARD_API_SESSION_COOKIE);
  return out;
}
