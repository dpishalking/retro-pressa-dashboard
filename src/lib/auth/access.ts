import type { AccessLevel } from "@/types/auth";
import { HUB_PATH } from "@/lib/auth/routes";

/** Route prefixes each access level may visit. Admin uses wildcard. */
export const ACCESS_ROUTE_PREFIXES: Record<AccessLevel, string[] | "*"> = {
  admin: "*",
  rop: [HUB_PATH, "/analytics", "/rop", "/training"],
  mop: [HUB_PATH, "/training"]
};

/** Sections marked «Скоро» — visible and open only to admin. */
export const FUTURE_ROUTE_PREFIXES = ["/correspondence", "/sales"];

/** Admin-only configuration area. */
export const ADMIN_ROUTE_PREFIXES = ["/admin"];

export function canAccessRoute(accessLevel: AccessLevel, pathname: string): boolean {
  const normalized = normalizePath(pathname);

  if (ADMIN_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return accessLevel === "admin";
  }

  if (FUTURE_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return accessLevel === "admin";
  }

  if (normalized.startsWith("/training/admin")) {
    return accessLevel === "admin";
  }

  const allowed = ACCESS_ROUTE_PREFIXES[accessLevel];
  if (allowed === "*") return true;

  return allowed.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function canSeeOfficeSection(accessLevel: AccessLevel, href: string): boolean {
  if (accessLevel === "admin") return true;

  if (FUTURE_ROUTE_PREFIXES.includes(href)) return false;

  return canAccessRoute(accessLevel, href);
}

export function accessLevelLabel(level: AccessLevel): string {
  switch (level) {
    case "admin":
      return "Администратор";
    case "rop":
      return "РОП";
    case "mop":
      return "Менеджер";
  }
}

export function accessLevelScope(level: AccessLevel): string {
  switch (level) {
    case "admin":
      return "все разделы кабинета, включая будущие";
    case "rop":
      return "аналитика, инструменты РОП, обучение менеджеров";
    case "mop":
      return "обучение менеджеров";
  }
}

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "") return "/";
  const withoutQuery = pathname.split("?")[0] ?? pathname;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}
