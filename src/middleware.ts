import { NextRequest, NextResponse } from "next/server";

// Lightweight middleware — only checks for session cookie existence.
// Full session validation (DB lookup) happens in each route via auth().
// This avoids importing Prisma/libsql into the Edge Runtime.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow auth callbacks and login page
  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    return NextResponse.next();
  }

  // NextAuth v5 session cookie names
  const sessionToken =
    req.cookies.get("__Secure-authjs.session-token") ?? // production (HTTPS)
    req.cookies.get("authjs.session-token");             // development (HTTP)

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
