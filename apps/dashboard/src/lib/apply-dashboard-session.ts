import "server-only";
import { NextResponse } from "next/server";
import { DASHBOARD_ACCESS_COOKIE, DASHBOARD_API_SESSION_COOKIE } from "@/lib/dashboard-cookies";

const SESSION_COOKIE_NAME = "appbase_session";
const ACCESS_TOKEN_MAX_AGE = 900;
const API_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type AuthJson = {
  success?: boolean;
  data?: {
    accessToken?: string;
    user?: { id: string; email: string; role?: string | null };
  };
  error?: { code?: string; message?: string };
};

/**
 * Maps an upstream `apps/api` login or bootstrap JSON + Set-Cookie into dashboard cookies.
 */
export async function nextResponseFromApiAuth(
  upstream: Response,
  opts: { requireAdminRole: boolean },
): Promise<NextResponse> {
  const json = (await upstream.json()) as AuthJson;

  if (!upstream.ok || !json.success || !json.data?.accessToken || !json.data.user) {
    return NextResponse.json(
      {
        success: false,
        error: json.error ?? { code: "AUTH_ERROR", message: "Authentication failed." },
      },
      { status: upstream.status >= 400 ? upstream.status : 401 },
    );
  }

  const isAdmin = json.data.user.role === "admin";
  if (opts.requireAdminRole && !isAdmin) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "FORBIDDEN", message: "Admin role required for the operator console." },
      },
      { status: 403 },
    );
  }
  if (!opts.requireAdminRole && !isAdmin) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Bootstrap did not yield an admin account." },
      },
      { status: 500 },
    );
  }

  let sessionToken: string | null = null;
  const raw = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const list = typeof raw.getSetCookie === "function" ? raw.getSetCookie() : [];
  for (const c of list) {
    if (c.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      const part = c.split(";")[0];
      sessionToken = part?.slice(SESSION_COOKIE_NAME.length + 1) ?? null;
      break;
    }
  }

  const secure = process.env.NODE_ENV === "production";
  const out = NextResponse.json({
    success: true,
    data: {
      user: {
        id: json.data.user.id,
        email: json.data.user.email,
        role: json.data.user.role,
      },
    },
  });

  out.cookies.set(DASHBOARD_ACCESS_COOKIE, json.data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  if (sessionToken) {
    out.cookies.set(DASHBOARD_API_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: API_SESSION_MAX_AGE,
    });
  }

  return out;
}
