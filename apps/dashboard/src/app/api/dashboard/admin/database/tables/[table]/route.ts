import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DASHBOARD_ACCESS_COOKIE } from "@/lib/dashboard-cookies";
import { fetchAsOperator } from "@/lib/operator-upstream";
import { requireOperatorBff } from "@/lib/require-operator";

type RouteParams = { params: Promise<{ table: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  const token = (await cookies()).get(DASHBOARD_ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
      { status: 401 },
    );
  }

  const { table } = await params;
  const u = new URL(request.url);
  const q = u.searchParams.toString();
  const path = `/admin/database/tables/${encodeURIComponent(table)}${q ? `?${q}` : ""}`;

  const upstream = await fetchAsOperator(path, token, { method: "GET" });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
