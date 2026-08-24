import type { AccessLevel, SessionUser } from "@/types/auth";

export function canAccessManagerCabinet(accessLevel: AccessLevel | undefined): boolean {
  return accessLevel === "admin" || accessLevel === "rop" || accessLevel === "mop";
}

export function canPickCabinetManager(accessLevel: AccessLevel | undefined): boolean {
  return accessLevel === "admin" || accessLevel === "rop";
}

export class ManagerCabinetAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ManagerCabinetAccessError";
    this.status = status;
  }
}

export function requireManagerCabinetSession(session: SessionUser | null): SessionUser {
  if (!session || !canAccessManagerCabinet(session.accessLevel)) {
    throw new ManagerCabinetAccessError("Нет доступа к кабинету менеджера", 403);
  }
  return session;
}
