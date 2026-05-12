import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/jwt";

const PROTECTED_PAGES = ["/feed", "/nutrition"];
const PROTECTED_API_PREFIXES = ["/api/posts", "/api/me", "/api/nutrition", "/api/friends", "/api/users"];

export const config = {
  matcher: ["/feed/:path*", "/nutrition/:path*", "/api/posts/:path*", "/api/me", "/api/nutrition/:path*", "/api/friends/:path*", "/api/users/:path*"]
};

export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = cookie ? await verifySession(cookie) : null;

  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  const isApi = PROTECTED_API_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));

  if (isApi) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (PROTECTED_PAGES.some((p) => req.nextUrl.pathname.startsWith(p))) {
    url.pathname = "/home";
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
