import type { SessionUser } from "@/types/auth";

export function isTrainingSupervisor(user: SessionUser | null | undefined): boolean {
  return user?.accessLevel === "admin" || user?.accessLevel === "rop";
}
