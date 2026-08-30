import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "starboard_session";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/login") return NextResponse.next();

  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
