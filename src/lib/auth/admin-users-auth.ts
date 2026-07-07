import type { AccessLevel } from "@/types/auth";
import type { SessionUser } from "@/types/auth";

export const USER_MANAGEMENT_PATH = "/admin/users";

export function canAccessUserManagement(accessLevel: AccessLevel): boolean {
  return accessLevel === "admin" || accessLevel === "rop";
}

export function isRopUserManager(session: SessionUser | null | undefined): boolean {
  return session?.accessLevel === "rop";
}

export function ropCanManageTargetUser(targetAccessLevel: AccessLevel): boolean {
  return targetAccessLevel === "mop";
}

export function assertRopCanCreateUser(session: SessionUser, accessLevel: AccessLevel): void {
  if (session.accessLevel !== "rop") return;
  if (accessLevel !== "mop") {
    throw new Error("РОП может создавать только аккаунты менеджеров");
  }
}

export function assertRopCanModifyUser(
  session: SessionUser,
  targetAccessLevel: AccessLevel,
  nextAccessLevel?: AccessLevel
): void {
  if (session.accessLevel !== "rop") return;
  if (!ropCanManageTargetUser(targetAccessLevel)) {
    throw new Error("РОП может изменять только аккаунты менеджеров");
  }
  if (nextAccessLevel !== undefined && nextAccessLevel !== "mop") {
    throw new Error("РОП может назначать только уровень «Менеджер»");
  }
}

export function assertRopCanDeleteUser(session: SessionUser, targetAccessLevel: AccessLevel): void {
  if (session.accessLevel !== "rop") return;
  if (!ropCanManageTargetUser(targetAccessLevel)) {
    throw new Error("РОП может удалять только аккаунты менеджеров");
  }
}
