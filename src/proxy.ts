import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: no session cookie → straight to the sign-in screen.
 * The real checks (valid session, membership, permissions) happen on the server
 * in every page and action; this only saves a round trip.
 */
const PUBLIC = ["/login", "/register", "/set-password", "/admin/login"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!req.cookies.get("rl_admin")) return NextResponse.redirect(new URL("/admin/login", req.url));
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) return NextResponse.next(); // API routes answer 401 themselves
  if (!req.cookies.get("rl_session")) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|fonts/|icon.svg|apple-icon.png|favicon.ico|roadline-).*)"],
};
