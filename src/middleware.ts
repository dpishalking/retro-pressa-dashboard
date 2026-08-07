import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute, homePathForAccessLevel } from "@/lib/auth/access";
import {
  HUB_PATH,
  MD_PUBLIC_PREFIX,
  PARTNERS_PATH,
  PARTNERS_REGISTER_API,
  PARTNERS_REGISTER_PATH,
  PRODUCT_CARDS_PUBLIC_PREFIX,
  PRODUCT_VIEW_PUBLIC_PREFIX,
  UTM_GENERATOR_PUBLIC_PATH,
  WEBINAR_PATH,
  WEBINAR_REGISTER_API
} from "@/lib/auth/routes";
import { readSessionCookie } from "@/lib/auth/session-edge";

const PUBLIC_API_PREFIXES = ["/api/auth/login", "/api/products/public", PARTNERS_REGISTER_API, WEBINAR_REGISTER_API];
const PUBLIC_PAGE_PREFIXES = [
  UTM_GENERATOR_PUBLIC_PATH,
  PRODUCT_VIEW_PUBLIC_PREFIX,
  PRODUCT_CARDS_PUBLIC_PREFIX,
  MD_PUBLIC_PREFIX,
  PARTNERS_REGISTER_PATH,
  WEBINAR_PATH
];
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
      return NextResponse.redirect(new URL(homePathForAccessLevel(session.accessLevel), request.url));
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

  const fallbackPath = homePathForAccessLevel(session.accessLevel);
  const deniedUrl = new URL(fallbackPath === HUB_PATH ? HUB_PATH : PARTNERS_PATH, request.url);
  deniedUrl.searchParams.set("denied", "1");
  return NextResponse.redirect(deniedUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
