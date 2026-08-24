import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute, homePathForAccessLevel } from "@/lib/auth/access";
import {
  MD_PUBLIC_PREFIX,
  PARTNERS_REGISTER_API,
  PARTNERS_REGISTER_PATH,
  PRODUCT_CARDS_PUBLIC_PREFIX,
  PRODUCT_VIEW_PUBLIC_PREFIX,
  UTM_GENERATOR_PUBLIC_PATH,
  WEBINAR_PATH,
  WEBINAR_REGISTER_API,
  GIFTS_PATH
} from "@/lib/auth/routes";
import { readSessionCookie } from "@/lib/auth/session-edge";

const PUBLIC_API_PREFIXES = ["/api/auth/login", "/api/health", "/api/products/public", PARTNERS_REGISTER_API, WEBINAR_REGISTER_API];
const PUBLIC_PAGE_PREFIXES = [
  UTM_GENERATOR_PUBLIC_PATH,
  PRODUCT_VIEW_PUBLIC_PREFIX,
  PRODUCT_CARDS_PUBLIC_PREFIX,
  MD_PUBLIC_PREFIX,
  PARTNERS_REGISTER_PATH,
  WEBINAR_PATH,
  GIFTS_PATH
];
const LOGIN_PATH = "/";
const CRON_API_PREFIXES = [
  "/api/rop/daily-sync",
  "/api/sync/os-daily",
  "/api/sync/predictive-front",
  "/api/sync/predictive-sheets",
  "/api/sync/bitrix",
  "/api/sync/bitrix-sales-foundation",
  "/api/sync/sales-os",
  "/api/sync/sales-cycle",
  "/api/sync/marketing-planning",
  "/api/sync/monthly-plan-facts"
];
const HEAVY_API_PREFIXES = ["/api/sync", "/api/rop/daily-sync"];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isCronApi(pathname: string): boolean {
  return CRON_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isHeavyApi(pathname: string): boolean {
  return HEAVY_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasValidCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SYNC_SECRET?.trim();
  if (!expected) return false;
  const provided = request.headers.get("x-cron-secret")?.trim();
  return Boolean(provided && provided === expected);
}

/** Worker self-calls from 127.0.0.1 when CRON_SYNC_SECRET is unset in GitHub. */
function isLoopbackRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === ":ffff:127.0.0.1";
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

    if (isHeavyApi(pathname) && process.env.RPBI_PROCESS_ROLE !== "worker") {
      return NextResponse.json(
        { error: "Синхронизация выполняется фоновым процессом" },
        { status: 503, headers: { "retry-after": "30" } }
      );
    }

    if (isCronApi(pathname) && (hasValidCronSecret(request) || isLoopbackRequest(request))) {
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

    if (isHeavyApi(pathname) && session.accessLevel !== "admin" && session.accessLevel !== "rop") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const deniedUrl = new URL(fallbackPath, request.url);
  deniedUrl.searchParams.set("denied", "1");
  return NextResponse.redirect(deniedUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
