import { NextResponse } from "next/server";
import { requireOperatorBff } from "@/lib/require-operator";
import { serverApiFetch } from "@/lib/server-api";

export async function POST() {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  const upstream = await serverApiFetch("/admin/api-key/rotate", {
    method: "POST",
    body: "{}",
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
