import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireOperatorBff } from "@/lib/require-operator";
import { serverApiFetch } from "@/lib/server-api";

type Params = { id: string };

export async function POST(request: NextRequest, context: { params: Promise<Params> }) {
  const denied = await requireOperatorBff();
  if (denied) return denied;

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

  const upstream = await serverApiFetch(`/admin/users/${encodeURIComponent(id)}/password`, {
    method: "POST",
    body,
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
