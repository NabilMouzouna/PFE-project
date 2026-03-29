import { cookies } from "next/headers";
import { DASHBOARD_ACCESS_COOKIE } from "@/lib/dashboard-cookies";
import { verifyOperatorAccessToken } from "@/lib/verify-access-token";

/** True when the dashboard has a valid operator (admin) access cookie. */
export async function isOperatorAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(DASHBOARD_ACCESS_COOKIE)?.value;
  if (!token) return false;
  return verifyOperatorAccessToken(token);
}
