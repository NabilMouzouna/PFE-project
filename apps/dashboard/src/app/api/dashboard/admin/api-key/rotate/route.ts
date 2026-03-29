import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DASHBOARD_ACCESS_COOKIE } from "@/lib/dashboard-cookies";
import { getDashboardServerEnv } from "@/lib/dashboard-env";
import { fetchAsOperator } from "@/lib/operator-upstream";
import { requireOperatorBff } from "@/lib/require-operator";
import { serverApiFetch } from "@/lib/server-api";

export async function POST() {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  const { DASHBOARD_API_KEY } = getDashboardServerEnv();

  let upstream: Response;
  if (DASHBOARD_API_KEY) {
    upstream = await serverApiFetch("/admin/api-key/rotate", {
      method: "POST",
      body: "{}",
    });
  } else {
    const token = (await cookies()).get(DASHBOARD_ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
        { status: 401 },
      );
    }
    upstream = await fetchAsOperator("/admin/api-key/rotate", token, {
      method: "POST",
      body: "{}",
    });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
