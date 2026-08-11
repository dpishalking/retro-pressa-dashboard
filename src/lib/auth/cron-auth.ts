import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";

/**
 * Allow GitHub Actions cron (`x-cron-secret`) or admin/rop session.
 * Returns null when authorized; otherwise a ready JSON 401/403 response.
 */
export function rejectUnlessCronOrStaff(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SYNC_SECRET?.trim();
  const provided = request.headers.get("x-cron-secret")?.trim();
  const isCron = Boolean(cronSecret && provided && provided === cronSecret);
  if (isCron) return null;

  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
