import { NextResponse } from "next/server";
import { requireOperatorBff } from "@/lib/require-operator";
import { serverPublicFetch } from "@/lib/server-api";

export async function GET() {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  const upstream = await serverPublicFetch("/health");
  const json = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_GATEWAY", message: "Invalid health response from API." } },
      { status: 502 },
    );
  }
  if (!upstream.ok) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNHEALTHY", message: "API reported unhealthy status." },
        data: json,
      },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ success: true, data: json });
}
