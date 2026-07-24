import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute } from "@/lib/auth/access";
import { GIFT2MAN_LANDING_PATH, HUB_PATH, UTM_GENERATOR_PUBLIC_PATH } from "@/lib/auth/routes";
import { readSessionCookie } from "@/lib/auth/session-edge";

const PUBLIC_API_PREFIXES = ["/api/auth/login"];
const PUBLIC_PAGE_PREFIXES = [UTM_GENERATOR_PUBLIC_PATH, GIFT2MAN_LANDING_PATH];
const LOGIN_PATH = "/";
const CRON_API_PREFIXES = [
  "/api/rop/daily-sync",
  "/api/sync/os-daily",
  "/api/sync/predictive-front"
];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isCronApi(pathname: string): boolean {
  return CRON_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasValidCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SYNC_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!expected) return false;
  const provided = request.headers.get("x-cron-secret")?.trim();
  return Boolean(provided && provided === expected);
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/retro-pressa-utm.js" ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".mp4") ||
    pathname.endsWith(".pdf") ||
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

    if (isCronApi(pathname) && hasValidCronSecret(request)) {
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

  if (isPublicPage(pathname)) {
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
