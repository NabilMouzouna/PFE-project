import { NextResponse } from "next/server";
import { requireOperatorBff } from "@/lib/require-operator";
import { getApiBaseUrl } from "@/lib/jwks";

export async function GET() {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  return NextResponse.json({
    success: true,
    data: { apiBaseUrl: getApiBaseUrl() },
  });
}
