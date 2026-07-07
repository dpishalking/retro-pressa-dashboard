import type { AccessLevel } from "@/types/auth";
import { HUB_PATH } from "@/lib/auth/routes";
import { USER_MANAGEMENT_PATH, canAccessUserManagement } from "@/lib/auth/admin-users-auth";

/** Route prefixes each access level may visit. Admin uses wildcard. */
export const ACCESS_ROUTE_PREFIXES: Record<AccessLevel, string[] | "*"> = {
  admin: "*",
  rop: [HUB_PATH, "/analytics", "/rop", "/training", USER_MANAGEMENT_PATH],
  mop: [HUB_PATH, "/training"]
};

/** Admin-only configuration area. */
export const ADMIN_ROUTE_PREFIXES = ["/admin"];

export function canAccessRoute(accessLevel: AccessLevel, pathname: string): boolean {
  const normalized = normalizePath(pathname);

  if (normalized.startsWith(USER_MANAGEMENT_PATH)) {
    return canAccessUserManagement(accessLevel);
  }

  if (ADMIN_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return accessLevel === "admin";
  }

  if (normalized.startsWith("/training/admin")) {
    return accessLevel === "admin";
  }

  if (normalized.startsWith("/training/supervisors")) {
    return accessLevel === "admin" || accessLevel === "rop";
  }

  const allowed = ACCESS_ROUTE_PREFIXES[accessLevel];
  if (allowed === "*") return true;

  return allowed.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function canSeeOfficeSection(accessLevel: AccessLevel, href: string): boolean {
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
      return "все разделы кабинета";
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
