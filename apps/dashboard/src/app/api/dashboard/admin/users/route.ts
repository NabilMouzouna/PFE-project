import { NextResponse } from "next/server";
import { requireOperatorBff } from "@/lib/require-operator";
import { serverApiFetch } from "@/lib/server-api";

export async function GET() {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  const upstream = await serverApiFetch("/admin/users");
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
