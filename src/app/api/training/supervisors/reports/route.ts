import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { buildManagerTrainingReport, listManagerTrainingReports } from "@/lib/training/manager-report";
import { isTrainingSupervisor } from "@/lib/training/supervisor-auth";
import { listTraineeUsers } from "@/lib/auth/store";

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!isTrainingSupervisor(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (userId) {
    const trainees = await listTraineeUsers();
    const trainee = trainees.find((user) => user.id === userId);
    if (!trainee) {
      return NextResponse.json({ error: "Manager not found" }, { status: 404 });
    }
    const report = await buildManagerTrainingReport(trainee);
    return NextResponse.json({ report });
  }

  const reports = await listManagerTrainingReports();
  return NextResponse.json({ reports });
}
