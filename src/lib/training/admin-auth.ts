import { readSessionCookie } from "@/lib/auth/session";
import type { SessionUser } from "@/types/auth";

export function readTrainingAdminSession(request: Request): SessionUser | null {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session || session.accessLevel !== "admin") {
    return null;
  }
  return session;
}
