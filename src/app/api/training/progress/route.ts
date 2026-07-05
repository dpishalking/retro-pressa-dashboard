import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import {
  getOrCreateUserProgress,
  getTrainingOverview,
  listAllManagerProgress,
  markBotScenarioCompleted,
  markBotScenarioStarted,
  markModuleStarted,
  markProductStarted
} from "@/lib/training/store";
import { resolveProgressTargetUserId } from "@/lib/training/progress-auth";
import { isTrainingSupervisor } from "@/lib/training/supervisor-auth";
import type { TrackStageId } from "@/types/training";

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all");

  if (all === "true") {
    if (!isTrainingSupervisor(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = await listAllManagerProgress();
    return NextResponse.json({ rows });
  }

  const access = resolveProgressTargetUserId(session, searchParams.get("userId"));
  if ("error" in access) {
    if (access.error === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (access.error === "missing") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [progress, overview] = await Promise.all([
    getOrCreateUserProgress(access.userId),
    getTrainingOverview(access.userId)
  ]);

  return NextResponse.json(
    { progress, overview },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  const body = (await request.json()) as {
    userId?: string;
    productId?: string;
    moduleId?: string;
    scenarioId?: string;
    stageId?: TrackStageId;
    action?: string;
  };

  if (!body.action) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const access = resolveProgressTargetUserId(session, body.userId ?? session?.id);
  if ("error" in access) {
    if (access.error === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = access.userId;

  if (body.action === "start_bot_scenario" && body.scenarioId) {
    const progress = await markBotScenarioStarted(userId, body.scenarioId);
    const overview = await getTrainingOverview(userId);
    return NextResponse.json({ progress, overview });
  }

  if (body.action === "complete_bot_scenario" && body.scenarioId) {
    const progress = await markBotScenarioCompleted(userId, body.scenarioId);
    const overview = await getTrainingOverview(userId);
    return NextResponse.json({ progress, overview });
  }

  if (body.action !== "start") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (body.moduleId && body.stageId && (body.stageId === "crm" || body.stageId === "practice")) {
    const progress = await markModuleStarted(userId, body.stageId, body.moduleId);
    const overview = await getTrainingOverview(userId);
    return NextResponse.json({ progress, overview });
  }

  if (!body.productId) {
    return NextResponse.json({ error: "productId or moduleId required" }, { status: 400 });
  }

  const progress = await markProductStarted(userId, body.productId);
  const overview = await getTrainingOverview(userId);
  return NextResponse.json({ progress, overview });
}
