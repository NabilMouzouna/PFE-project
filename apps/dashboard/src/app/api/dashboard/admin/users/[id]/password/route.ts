import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DASHBOARD_ACCESS_COOKIE } from "@/lib/dashboard-cookies";
import { fetchAsOperator } from "@/lib/operator-upstream";
import { requireOperatorBff } from "@/lib/require-operator";

type Params = { id: string };

export async function POST(request: NextRequest, context: { params: Promise<Params> }) {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  const token = (await cookies()).get(DASHBOARD_ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  let body: string;
  try {
    const json = await request.json();
    body = JSON.stringify(json);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const upstream = await fetchAsOperator(`/admin/users/${encodeURIComponent(id)}/password`, token, {
    method: "POST",
    body,
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
