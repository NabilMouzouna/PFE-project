import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DASHBOARD_ACCESS_COOKIE, DASHBOARD_API_SESSION_COOKIE } from "@/lib/dashboard-cookies";
import { verifyOperatorAccessToken } from "@/lib/verify-access-token";

const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/docs"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === "/login" || pathname === "/register") {
      const token = request.cookies.get(DASHBOARD_ACCESS_COOKIE)?.value;
      if (token) {
        const ok = await verifyOperatorAccessToken(token);
        if (ok) {
          return NextResponse.redirect(new URL("/overview", request.url));
        }
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(DASHBOARD_ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const ok = await verifyOperatorAccessToken(token);
  if (!ok) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(DASHBOARD_ACCESS_COOKIE);
    res.cookies.delete(DASHBOARD_API_SESSION_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
