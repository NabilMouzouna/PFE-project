import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DASHBOARD_ACCESS_COOKIE } from "@/lib/dashboard-cookies";
import { fetchAsOperator } from "@/lib/operator-upstream";
import { requireOperatorBff } from "@/lib/require-operator";

export async function GET(request: NextRequest) {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  const token = (await cookies()).get(DASHBOARD_ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
      { status: 401 },
    );
  }

  const qs = request.nextUrl.searchParams.toString();
  const path = qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
  const upstream = await fetchAsOperator(path, token);
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
