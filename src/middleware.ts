import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get("ae_session");
  if (!session?.value) {
    const url = new URL("/login", request.url);
    const res = NextResponse.redirect(url);
    // Prevent Vercel edge from caching redirects
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.headers.set("x-middleware-cache", "no-cache");
    return res;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(session.value, "base64").toString("utf-8")
    );
    if (payload.authenticated !== true || payload.expires < Date.now()) {
      const url = new URL("/login", request.url);
      const res = NextResponse.redirect(url);
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.headers.set("x-middleware-cache", "no-cache");
      return res;
    }
  } catch {
    const url = new URL("/login", request.url);
    const res = NextResponse.redirect(url);
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.headers.set("x-middleware-cache", "no-cache");
    return res;
  }

  // Authenticated — pass through with no-cache to ensure fresh auth checks
  const res = NextResponse.next();
  res.headers.set("x-middleware-cache", "no-cache");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
