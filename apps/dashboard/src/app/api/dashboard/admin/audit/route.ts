import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireOperatorBff } from "@/lib/require-operator";
import { serverApiFetch } from "@/lib/server-api";

export async function GET(request: NextRequest) {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  const qs = request.nextUrl.searchParams.toString();
  const path = qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
  const upstream = await serverApiFetch(path);
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
