import { NextResponse } from "next/server";
import { canAccessUserManagement } from "@/lib/auth/admin-users-auth";
import { countPendingRegistrations } from "@/lib/auth/store";
import { readSessionCookie } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let pendingRegistrationCount = 0;
  if (canAccessUserManagement(session.accessLevel)) {
    try {
      pendingRegistrationCount = await countPendingRegistrations();
    } catch {
      pendingRegistrationCount = 0;
    }
  }

  return NextResponse.json({ user: session, pendingRegistrationCount });
}
