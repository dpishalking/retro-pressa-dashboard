import type { AccessLevel } from "@/types/auth";
import type { SessionUser } from "@/types/auth";

export const USER_MANAGEMENT_PATH = "/admin/users";

export function canAccessUserManagement(accessLevel: AccessLevel): boolean {
  return accessLevel === "admin" || accessLevel === "rop";
}

export function pendingRegistrationPhrase(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} заявка на регистрацию ждёт одобрения`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} заявки на регистрацию ждут одобрения`;
  return `${count} заявок на регистрацию ждут одобрения`;
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
