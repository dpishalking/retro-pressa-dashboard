import type { AccessLevel, SessionUser } from "@/types/auth";

export function canViewMotivation(accessLevel: AccessLevel | undefined): boolean {
  return accessLevel === "admin" || accessLevel === "rop" || accessLevel === "mop";
}

export function canManageMotivation(accessLevel: AccessLevel | undefined): boolean {
  return accessLevel === "admin" || accessLevel === "rop";
}

export function canSeeFullLeaderboard(accessLevel: AccessLevel | undefined): boolean {
  return accessLevel === "admin" || accessLevel === "rop";
}

export function requireMotivationSession(session: SessionUser | null): SessionUser {
  if (!session || !canViewMotivation(session.accessLevel)) {
    throw new MotivationAccessError("Нет доступа к разделу мотивации", 403);
  }
  return session;
}

export function requireMotivationManager(session: SessionUser | null): SessionUser {
  const user = requireMotivationSession(session);
  if (!canManageMotivation(user.accessLevel)) {
    throw new MotivationAccessError("Недостаточно прав для управления мотивацией", 403);
  }
  return user;
}

export class MotivationAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MotivationAccessError";
    this.status = status;
  }
}
