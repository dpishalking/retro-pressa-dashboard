import type { SessionUser } from "@/types/auth";
import { isTrainingSupervisor } from "@/lib/training/supervisor-auth";

type ProgressAccessResult =
  | { userId: string }
  | { error: "unauthorized" | "forbidden" | "missing" };

export function resolveProgressTargetUserId(
  session: SessionUser | null,
  requestedUserId: string | null | undefined
): ProgressAccessResult {
  if (!session) return { error: "unauthorized" };
  if (!requestedUserId) return { userId: session.id };
  if (session.id === requestedUserId || isTrainingSupervisor(session)) {
    return { userId: requestedUserId };
  }
  return { error: "forbidden" };
}
