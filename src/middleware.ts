import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute } from "@/lib/auth/access";
import { HUB_PATH } from "@/lib/auth/routes";
import { readSessionCookie } from "@/lib/auth/session-edge";

const PUBLIC_API_PREFIXES = ["/api/auth/login"];
const LOGIN_PATH = "/";

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const session = await readSessionCookie(request.headers.get("cookie"));

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (pathname.startsWith("/api/admin/")) {
      if (pathname.startsWith("/api/admin/users")) {
        if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else if (session.accessLevel !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.next();
  }

  if (pathname === LOGIN_PATH) {
    if (session) {
      return NextResponse.redirect(new URL(HUB_PATH, request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (canAccessRoute(session.accessLevel, pathname)) {
    return NextResponse.next();
  }

  const hubUrl = new URL(HUB_PATH, request.url);
  hubUrl.searchParams.set("denied", "1");
  return NextResponse.redirect(hubUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
