import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DASHBOARD_ACCESS_COOKIE } from "@/lib/dashboard-cookies";
import { getDashboardServerEnv } from "@/lib/dashboard-env";
import { fetchAsOperator } from "@/lib/operator-upstream";
import { requireOperatorBff } from "@/lib/require-operator";
import { serverApiFetch } from "@/lib/server-api";

function normalizeApiKeyBody(body: unknown, bffConfigured: boolean): unknown {
  if (!body || typeof body !== "object" || !("success" in body) || !("data" in body)) {
    return body;
  }
  const wrap = body as { success?: boolean; data: Record<string, unknown> };
  if (!wrap.success || typeof wrap.data !== "object" || wrap.data === null) {
    return body;
  }
  const d = wrap.data;

  if (bffConfigured) {
    return {
      success: true,
      data: {
        status: "active" as const,
        keyPrefix: d.keyPrefix,
        masked: d.masked,
        lastRotatedAt: d.lastRotatedAt ?? null,
        bffConfigured: true,
      },
    };
  }

  if (d.status === "missing") {
    return { success: true, data: { status: "missing" as const, bffConfigured: false } };
  }
  if (d.status === "active") {
    return {
      success: true,
      data: {
        status: "active" as const,
        keyPrefix: d.keyPrefix,
        masked: d.masked,
        lastRotatedAt: d.lastRotatedAt ?? null,
        bffConfigured: false,
      },
    };
  }
  return body;
}

export async function GET() {
  const denied = await requireOperatorBff();
  if (denied) return denied;

  const { DASHBOARD_API_KEY } = getDashboardServerEnv();

  let upstream: Response;
  if (DASHBOARD_API_KEY) {
    upstream = await serverApiFetch("/admin/api-key");
  } else {
    const token = (await cookies()).get(DASHBOARD_ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
        { status: 401 },
      );
    }
    upstream = await fetchAsOperator("/admin/api-key/setup-status", token, { method: "GET" });
  }

  const text = await upstream.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_UPSTREAM", message: "Invalid JSON from API." } },
      { status: 502 },
    );
  }

  if (upstream.ok) {
    body = normalizeApiKeyBody(body, Boolean(DASHBOARD_API_KEY));
  }

  return new NextResponse(JSON.stringify(body), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
