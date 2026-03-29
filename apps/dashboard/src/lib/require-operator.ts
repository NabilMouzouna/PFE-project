import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DASHBOARD_ACCESS_COOKIE, DASHBOARD_API_SESSION_COOKIE } from "@/lib/dashboard-cookies";
import { verifyOperatorSession } from "@/lib/verify-operator-session";

/** Returns a 401 NextResponse if the operator session is missing or invalid. */
export async function requireOperatorBff(): Promise<NextResponse | null> {
  const store = await cookies();
  const token = store.get(DASHBOARD_ACCESS_COOKIE)?.value;
  const apiSession = store.get(DASHBOARD_API_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
      { status: 401 },
    );
  }
  if (!(await verifyOperatorSession(token, apiSession))) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Session expired or invalid." } },
      { status: 401 },
    );
  }
  return null;
}
