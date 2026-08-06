import type { SessionUser } from "@/types/auth";

export function requirePartnerSession(session: SessionUser | null): SessionUser {
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (session.accessLevel !== "partner" && session.accessLevel !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
}

export function requireAdminSession(session: SessionUser | null): SessionUser {
  if (!session || session.accessLevel !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
}
