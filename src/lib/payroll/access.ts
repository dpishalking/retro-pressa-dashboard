import type { AccessLevel, SessionUser } from "@/types/auth";

export function canAccessPayroll(accessLevel: AccessLevel | undefined): boolean {
  return accessLevel === "admin" || accessLevel === "rop";
}

export class PayrollAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PayrollAccessError";
    this.status = status;
  }
}

export function requirePayrollSession(session: SessionUser | null): SessionUser {
  if (!session || !canAccessPayroll(session.accessLevel)) {
    throw new PayrollAccessError("Нет доступа к калькулятору зарплат", 403);
  }
  return session;
}
